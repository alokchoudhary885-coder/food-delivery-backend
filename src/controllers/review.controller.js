/**
 * @file src/controllers/review.controller.js
 * @description Review route handlers.
 */

const Review = require('../models/review.model');
const Restaurant = require('../models/restaurant.model');
const Order = require('../models/order.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { StatusCodes } = require('http-status-codes');

/**
 * POST /api/v1/reviews
 * Create a review for a restaurant/order
 */
const createReview = catchAsync(async (req, res) => {
  const { restaurantId, orderId, rating, comment } = req.body;

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404);
  }

  if (orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    const existingReview = await Review.findOne({ user: req.user._id, order: orderId });
    if (existingReview) {
      throw new AppError('Aapne is order par pehle hi review de diya hai', 400);
    }
  }

  const review = await Review.create({
    user: req.user._id,
    restaurant: restaurantId,
    order: orderId || null,
    rating,
    comment,
  });

  const populatedReview = await Review.findById(review._id).populate('user', 'name');

  sendSuccess(res, StatusCodes.CREATED, 'Review added successfully!', { review: populatedReview });
});

/**
 * GET /api/v1/reviews/restaurant/:restaurantId
 * Get all reviews for a restaurant
 */
const getRestaurantReviews = catchAsync(async (req, res) => {
  const { restaurantId } = req.params;
  const reviews = await Review.find({ restaurant: restaurantId })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(20);

  sendSuccess(res, StatusCodes.OK, 'Reviews fetched successfully', { reviews });
});

module.exports = { createReview, getRestaurantReviews };
