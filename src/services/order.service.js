/**
 * @file src/services/order.service.js
 * @description Order business logic — placement, status management, history.
 */

const Order = require('../models/order.model');
const MenuItem = require('../models/menuItem.model');
const Restaurant = require('../models/restaurant.model');
const AppError = require('../utils/AppError');

// Valid transitions for the order state machine
const VALID_TRANSITIONS = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['preparing', 'cancelled'],
  preparing:        ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered:        [],
  cancelled:        [],
};

/**
 * Place a new order.
 * Validates each item exists and belongs to the given restaurant.
 * Calculates total from live DB prices (not client-sent prices).
 *
 * @param {string} customerId
 * @param {object} data - { restaurant, items, deliveryAddress, paymentMethod }
 */
const placeOrder = async (customerId, data) => {
  const { restaurant: restaurantId, items, deliveryAddress, paymentMethod } = data;

  // 1. Check restaurant exists and is active
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) { throw new AppError('Restaurant not found.', 404); }
  if (!restaurant.isActive) { throw new AppError('This restaurant is currently not accepting orders.', 400); }

  // 2. Fetch all menu items in one query
  const menuItemIds = items.map((i) => i.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });

  if (menuItems.length !== items.length) {
    throw new AppError('One or more menu items are invalid.', 400);
  }

  // 3. Validate all items belong to this restaurant and are available
  const menuItemMap = {};
  for (const item of menuItems) {
    if (item.restaurant.toString() !== restaurantId) {
      throw new AppError(`Menu item "${item.name}" does not belong to this restaurant.`, 400);
    }
    if (!item.isAvailable) {
      throw new AppError(`Menu item "${item.name}" is currently unavailable.`, 400);
    }
    menuItemMap[item._id.toString()] = item;
  }

  // 4. Build order items with price snapshots (use DB price, not client price)
  const orderItems = items.map((i) => {
    const item = menuItemMap[i.menuItem];
    return {
      menuItem: item._id,
      name: item.name,        // Snapshot
      price: item.price,      // Snapshot — immune to future price changes
      quantity: i.quantity,
    };
  });

  // 5. Calculate total amount
  const totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // 6. Check minimum order
  if (totalAmount < restaurant.minimumOrder) {
    throw new AppError(
      `Minimum order for this restaurant is ₹${restaurant.minimumOrder}. Your cart total is ₹${totalAmount}.`,
      400
    );
  }

  // 7. Create the order
  const order = await Order.create({
    customer: customerId,
    userId: customerId,
    restaurant: restaurantId,
    items: orderItems,
    deliveryAddress,
    totalAmount,
    deliveryFee: restaurant.deliveryFee,
    paymentMethod,
  });

  return order;
};

/**
 * Get orders for the logged-in customer.
 * @param {string} customerId
 * @param {object} query - { status, page, limit }
 */
const getMyOrders = async (customerId, query) => {
  const { status, page = 1, limit = 10 } = query;

  const filter = { customer: customerId };
  if (status) { filter.status = status; }

  const options = {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: [
      { path: 'restaurant', select: 'name image address deliveryFee' },
    ],
  };

  const result = await Order.paginate(filter, options);
  return result;
};

/**
 * Get orders for a restaurant (owner view).
 * @param {string} restaurantId
 * @param {string} ownerId
 * @param {object} query
 */
const getRestaurantOrders = async (restaurantId, ownerId, query) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) { throw new AppError('Restaurant not found.', 404); }

  if (restaurant.owner.toString() !== ownerId.toString()) {
    throw new AppError('You are not authorized to view orders for this restaurant.', 403);
  }

  const { status, page = 1, limit = 10 } = query;

  const filter = { restaurant: restaurantId };
  if (status) { filter.status = status; }

  const options = {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: { path: 'customer', select: 'name email phone' },
  };

  const result = await Order.paginate(filter, options);
  return result;
};

/**
 * Get a single order by ID.
 * Only the customer who placed it, the restaurant owner, or an admin can view.
 * @param {string} orderId
 * @param {object} requestingUser
 */
const getOrderById = async (orderId, requestingUser) => {
  const order = await Order.findById(orderId)
    .populate('customer', 'name email phone')
    .populate('restaurant', 'name image address phone')
    .populate('items.menuItem', 'name image');

  if (!order) { throw new AppError('Order not found.', 404); }

  const isCustomer = order.customer._id.toString() === requestingUser._id.toString();
  const isAdmin = requestingUser.role === 'admin';

  if (!isCustomer && !isAdmin) {
    throw new AppError('You are not authorized to view this order.', 403);
  }

  return order;
};

/**
 * Update order status (owner/admin only).
 * Enforces a valid state machine transition.
 * @param {string} orderId
 * @param {string} newStatus
 * @param {string} cancellationReason
 * @param {object} requestingUser
 */
const updateOrderStatus = async (orderId, newStatus, cancellationReason, requestingUser) => {
  const order = await Order.findById(orderId).populate('restaurant');
  if (!order) { throw new AppError('Order not found.', 404); }

  const isOwner = order.restaurant.owner.toString() === requestingUser._id.toString();
  const isAdmin = requestingUser.role === 'admin';
  const isCustomer = order.customer.toString() === requestingUser._id.toString();

  // Customers can only cancel their own orders
  if (isCustomer && newStatus !== 'cancelled') {
    throw new AppError('Customers can only cancel orders.', 403);
  }

  if (!isOwner && !isAdmin && !isCustomer) {
    throw new AppError('You are not authorized to update this order.', 403);
  }

  // Enforce valid state machine transition
  const allowedNextStatuses = VALID_TRANSITIONS[order.status];
  if (!allowedNextStatuses.includes(newStatus)) {
    throw new AppError(
      `Cannot transition order from "${order.status}" to "${newStatus}".`,
      400
    );
  }

  // Update status-specific timestamps
  const timestampMap = {
    confirmed:        'confirmedAt',
    preparing:        'preparingAt',
    out_for_delivery: 'outForDeliveryAt',
    delivered:        'deliveredAt',
    cancelled:        'cancelledAt',
  };

  const updateData = { status: newStatus };
  if (timestampMap[newStatus]) {
    updateData[timestampMap[newStatus]] = new Date();
  }
  if (newStatus === 'cancelled' && cancellationReason) {
    updateData.cancellationReason = cancellationReason;
  }

  const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true });
  return updatedOrder;
};

module.exports = {
  placeOrder,
  getMyOrders,
  getRestaurantOrders,
  getOrderById,
  updateOrderStatus,
};
