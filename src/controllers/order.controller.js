/**
 * @file src/controllers/order.controller.js
 * @description Order route handlers.
 */

const { StatusCodes } = require('http-status-codes');
const orderService = require('../services/order.service');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendPaginatedSuccess } = require('../utils/response');
const { sendOrderPlacedEmail, sendOrderStatusEmail } = require('../services/email.service');

/**
 * POST /api/v1/orders
 * @access Private (customer)
 */
const placeOrder = catchAsync(async (req, res) => {
  const order = await orderService.placeOrder(req.user._id, req.body);
  sendSuccess(res, StatusCodes.CREATED, 'Order placed successfully.', { order });

  // Send email notification (non-blocking)
  sendOrderPlacedEmail({
    customerEmail: req.user.email,
    customerName:  req.user.name,
    order,
    restaurantName: order.restaurant?.name || 'Restaurant',
  }).catch(() => {});
});

/**
 * GET /api/v1/orders/my-orders
 * @access Private (customer)
 */
const getMyOrders = catchAsync(async (req, res) => {
  const result = await orderService.getMyOrders(req.user._id, req.query);
  sendPaginatedSuccess(res, 'orders', result.docs, {
    page:         result.page,
    limit:        result.limit,
    totalPages:   result.totalPages,
    totalResults: result.totalDocs,
  });
});

/**
 * GET /api/v1/orders/restaurant/:restaurantId
 * @access Private (owner)
 */
const getRestaurantOrders = catchAsync(async (req, res) => {
  const result = await orderService.getRestaurantOrders(
    req.params.restaurantId,
    req.user._id,
    req.query
  );
  sendPaginatedSuccess(res, 'orders', result.docs, {
    page:         result.page,
    limit:        result.limit,
    totalPages:   result.totalPages,
    totalResults: result.totalDocs,
  });
});

/**
 * GET /api/v1/orders/:id
 * @access Private (customer who placed it, or admin)
 */
const getOrderById = catchAsync(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user);
  sendSuccess(res, StatusCodes.OK, 'Order fetched successfully.', { order });
});

/**
 * PATCH /api/v1/orders/:id/status
 * @access Private (owner, admin, customer for cancellation)
 */
const updateOrderStatus = catchAsync(async (req, res) => {
  const { status, cancellationReason } = req.body;
  const order = await orderService.updateOrderStatus(
    req.params.id,
    status,
    cancellationReason,
    req.user
  );
  sendSuccess(res, StatusCodes.OK, `Order status updated to "${status}".`, { order });

  // Send status update email to customer (non-blocking)
  if (order.customerEmail) {
    sendOrderStatusEmail({
      customerEmail: order.customerEmail,
      customerName:  order.customerName || 'Customer',
      orderId:       order._id,
      status,
    }).catch(() => {});
  }
});

module.exports = {
  placeOrder,
  getMyOrders,
  getRestaurantOrders,
  getOrderById,
  updateOrderStatus,
};
