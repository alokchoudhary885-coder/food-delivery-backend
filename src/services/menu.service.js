/**
 * @file src/services/menu.service.js
 * @description Menu item business logic.
 */

const mongoose = require('mongoose');
const MenuItem = require('../models/menuItem.model');
const Restaurant = require('../models/restaurant.model');
const AppError = require('../utils/AppError');

/**
 * Helper: validate that a string is a proper MongoDB ObjectId.
 * Throws a 400 AppError immediately so callers get a clear message.
 * @param {string} id
 * @param {string} label - Human-readable label for error messages.
 */
const validateObjectId = (id, label = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}: "${id}" is not a valid MongoDB ObjectId.`, 400);
  }
};

/**
 * Add a menu item to a restaurant (owner only).
 * @param {string} restaurantId
 * @param {string} ownerId
 * @param {object} data
 */
const addMenuItem = async (restaurantId, ownerId, data) => {
  // Validate ObjectId format before hitting the database
  validateObjectId(restaurantId, 'restaurantId');

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    throw new AppError('Restaurant not found.', 404);
  }

  if (restaurant.owner.toString() !== ownerId.toString()) {
    throw new AppError('You can only add items to your own restaurant.', 403);
  }

  const menuItem = await MenuItem.create({ ...data, restaurant: restaurantId });
  return menuItem;
};

/**
 * Get all menu items for a restaurant with pagination.
 * @param {string} restaurantId
 * @param {object} query - { category, isVeg, isAvailable, page, limit }
 */
const getMenuByRestaurant = async (restaurantId, query) => {
  // Validate ObjectId format before hitting the database
  validateObjectId(restaurantId, 'restaurantId');

  const { category, isVeg, isAvailable, page = 1, limit = 20 } = query;

  const filter = { restaurant: restaurantId };
  if (category) { filter.category = category; }
  if (isVeg !== undefined) { filter.isVeg = isVeg === 'true'; }
  if (isAvailable !== undefined) { filter.isAvailable = isAvailable === 'true'; }

  const options = {
    page: Number(page),
    limit: Number(limit),
    sort: { category: 1, name: 1 },
  };

  const result = await MenuItem.paginate(filter, options);
  return result;
};

/**
 * Get a single menu item by ID.
 * @param {string} itemId
 */
const getMenuItemById = async (itemId) => {
  const item = await MenuItem.findById(itemId).populate('restaurant', 'name address');
  if (!item) { throw new AppError('Menu item not found.', 404); }
  return item;
};

/**
 * Update a menu item (owner of the restaurant only).
 * @param {string} itemId
 * @param {string} ownerId
 * @param {object} updateData
 */
const updateMenuItem = async (itemId, ownerId, updateData) => {
  const item = await MenuItem.findById(itemId).populate('restaurant');
  if (!item) { throw new AppError('Menu item not found.', 404); }

  if (item.restaurant.owner.toString() !== ownerId.toString()) {
    throw new AppError('You can only update items from your own restaurant.', 403);
  }

  const updated = await MenuItem.findByIdAndUpdate(itemId, updateData, {
    new: true,
    runValidators: true,
  });

  return updated;
};

/**
 * Delete a menu item (owner of the restaurant only).
 * @param {string} itemId
 * @param {string} ownerId
 */
const deleteMenuItem = async (itemId, ownerId) => {
  const item = await MenuItem.findById(itemId).populate('restaurant');
  if (!item) { throw new AppError('Menu item not found.', 404); }

  if (item.restaurant.owner.toString() !== ownerId.toString()) {
    throw new AppError('You can only delete items from your own restaurant.', 403);
  }

  await MenuItem.findByIdAndDelete(itemId);
};

module.exports = {
  addMenuItem,
  getMenuByRestaurant,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
};
