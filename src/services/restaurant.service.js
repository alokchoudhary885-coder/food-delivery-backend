/**
 * @file src/services/restaurant.service.js
 * @description Restaurant business logic.
 */

const Restaurant = require('../models/restaurant.model');
const AppError = require('../utils/AppError');

/**
 * Create a new restaurant (owner only).
 * @param {object} data
 * @param {string} ownerId
 */
const createRestaurant = async (data, ownerId) => {
  const restaurant = await Restaurant.create({ ...data, owner: ownerId });
  return restaurant;
};

/**
 * Get all active restaurants with optional city filter.
 * @param {object} query - { city, cuisine, page, limit }
 */
const getAllRestaurants = async (query) => {
  const { city, cuisine, page = 1, limit = 10 } = query;

  const filter = { isActive: true };
  if (city) { filter['address.city'] = new RegExp(city, 'i'); }
  if (cuisine) { filter.cuisine = cuisine; }

  const skip = (page - 1) * limit;

  const [restaurants, total] = await Promise.all([
    Restaurant.find(filter)
      .populate('owner', 'name email')
      .skip(skip)
      .limit(Number(limit))
      .sort({ rating: -1 }),
    Restaurant.countDocuments(filter),
  ]);

  return {
    restaurants,
    pagination: {
      totalResults: total,
      page:         Number(page),
      limit:        Number(limit),
      totalPages:   Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single restaurant by ID (with its menu).
 * @param {string} restaurantId
 */
const getRestaurantById = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId)
    .populate('owner', 'name email')
    .populate('menu');

  if (!restaurant) {
    throw new AppError('Restaurant not found.', 404);
  }
  return restaurant;
};

/**
 * Update a restaurant (owner of that restaurant only).
 * @param {string} restaurantId
 * @param {string} ownerId
 * @param {object} updateData
 */
const updateRestaurant = async (restaurantId, ownerId, updateData) => {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    throw new AppError('Restaurant not found.', 404);
  }

  // Ownership check — admin can bypass (handled in controller)
  if (restaurant.owner.toString() !== ownerId.toString()) {
    throw new AppError('You are not authorized to update this restaurant.', 403);
  }

  const updated = await Restaurant.findByIdAndUpdate(restaurantId, updateData, {
    new: true,           // Return updated document
    runValidators: true, // Run schema validators on update
  });

  return updated;
};

/**
 * Delete a restaurant (admin only — soft delete by setting isActive: false).
 * @param {string} restaurantId
 */
const deleteRestaurant = async (restaurantId) => {
  const restaurant = await Restaurant.findByIdAndUpdate(
    restaurantId,
    { isActive: false },
    { new: true }
  );

  if (!restaurant) {
    throw new AppError('Restaurant not found.', 404);
  }

  return restaurant;
};

/**
 * Get restaurants owned by a specific user.
 * @param {string} ownerId
 */
const getMyRestaurants = async (ownerId) => {
  const restaurants = await Restaurant.find({ owner: ownerId }).sort({ createdAt: -1 });
  return restaurants;
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getMyRestaurants,
};
