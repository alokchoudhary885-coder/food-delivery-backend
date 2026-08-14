/**
 * @file src/controllers/restaurant.controller.js
 * @description Restaurant route handlers.
 */

const { StatusCodes } = require('http-status-codes');
const restaurantService = require('../services/restaurant.service');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendPaginatedSuccess } = require('../utils/response');

/**
 * POST /api/v1/restaurants
 * @access Private (owner)
 */
const createRestaurant = catchAsync(async (req, res) => {
  const restaurant = await restaurantService.createRestaurant(req.body, req.user._id);
  sendSuccess(res, StatusCodes.CREATED, 'Restaurant created successfully.', { restaurant });
});

/**
 * GET /api/v1/restaurants
 * @access Public
 */
const getAllRestaurants = catchAsync(async (req, res) => {
  const { restaurants, pagination } = await restaurantService.getAllRestaurants(req.query);
  sendPaginatedSuccess(res, 'restaurants', restaurants, pagination);
});

/**
 * GET /api/v1/restaurants/nearby
 * @access Public
 */
const getNearbyRestaurants = catchAsync(async (req, res) => {
  const { lat, lng, radius, cuisine, minRating, name } = req.query;
  const restaurants = await restaurantService.getNearbyRestaurants(
    lat,
    lng,
    radius,
    { cuisine, minRating, name }
  );
  sendSuccess(res, StatusCodes.OK, 'Nearby restaurants fetched successfully.', { restaurants, total: restaurants.length });
});

/**
 * GET /api/v1/restaurants/my-restaurants
 * @access Private (owner)
 */
const getMyRestaurants = catchAsync(async (req, res) => {
  const restaurants = await restaurantService.getMyRestaurants(req.user._id);
  sendSuccess(res, StatusCodes.OK, 'Your restaurants fetched successfully.', { restaurants });
});

/**
 * GET /api/v1/restaurants/:id
 * @access Public
 */
const getRestaurantById = catchAsync(async (req, res) => {
  const restaurant = await restaurantService.getRestaurantById(req.params.id);
  sendSuccess(res, StatusCodes.OK, 'Restaurant fetched successfully.', { restaurant });
});

/**
 * PUT /api/v1/restaurants/:id
 * @access Private (owner)
 */
const updateRestaurant = catchAsync(async (req, res) => {
  const restaurant = await restaurantService.updateRestaurant(
    req.params.id,
    req.user._id,
    req.body
  );
  sendSuccess(res, StatusCodes.OK, 'Restaurant updated successfully.', { restaurant });
});

/**
 * DELETE /api/v1/restaurants/:id
 * @access Private (admin)
 */
const deleteRestaurant = catchAsync(async (req, res) => {
  await restaurantService.deleteRestaurant(req.params.id);
  sendSuccess(res, StatusCodes.OK, 'Restaurant deactivated successfully.', null);
});

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getMyRestaurants,
  getRestaurantById,
  getNearbyRestaurants,
  updateRestaurant,
  deleteRestaurant,
};
