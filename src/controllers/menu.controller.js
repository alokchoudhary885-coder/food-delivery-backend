/**
 * @file src/controllers/menu.controller.js
 * @description Menu item route handlers.
 */

const { StatusCodes } = require('http-status-codes');
const menuService = require('../services/menu.service');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendPaginatedSuccess } = require('../utils/response');

/**
 * POST /api/v1/restaurants/:restaurantId/menu
 * @access Private (owner)
 */
const addMenuItem = catchAsync(async (req, res) => {
  const item = await menuService.addMenuItem(
    req.params.restaurantId,
    req.user._id,
    req.body
  );
  sendSuccess(res, StatusCodes.CREATED, 'Menu item added successfully.', { item });
});

/**
 * GET /api/v1/restaurants/:restaurantId/menu
 * @access Public
 */
const getMenuByRestaurant = catchAsync(async (req, res) => {
  const result = await menuService.getMenuByRestaurant(req.params.restaurantId, req.query);
  sendPaginatedSuccess(res, 'items', result.docs, {
    page:         result.page,
    limit:        result.limit,
    totalPages:   result.totalPages,
    totalResults: result.totalDocs,
  });
});

/**
 * GET /api/v1/menu/:id
 * @access Public
 */
const getMenuItemById = catchAsync(async (req, res) => {
  const item = await menuService.getMenuItemById(req.params.id);
  sendSuccess(res, StatusCodes.OK, 'Menu item fetched successfully.', { item });
});

/**
 * PUT /api/v1/menu/:id
 * @access Private (owner)
 */
const updateMenuItem = catchAsync(async (req, res) => {
  const item = await menuService.updateMenuItem(req.params.id, req.user._id, req.body);
  sendSuccess(res, StatusCodes.OK, 'Menu item updated successfully.', { item });
});

/**
 * DELETE /api/v1/menu/:id
 * @access Private (owner)
 */
const deleteMenuItem = catchAsync(async (req, res) => {
  await menuService.deleteMenuItem(req.params.id, req.user._id);
  sendSuccess(res, StatusCodes.OK, 'Menu item deleted successfully.', null);
});

module.exports = {
  addMenuItem,
  getMenuByRestaurant,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
};
