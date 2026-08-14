/**
 * @file src/controllers/ai.controller.js
 * @description Controller for AI food recommendations and menu generator.
 */

const { StatusCodes } = require('http-status-codes');
const aiService = require('../services/ai.service');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

/**
 * POST /api/v1/ai/recommend
 * Public endpoint for AI food assistant recommendations.
 */
const recommendFood = catchAsync(async (req, res) => {
  const { query } = req.body;
  const result = await aiService.getFoodRecommendations(query);
  sendSuccess(res, StatusCodes.OK, 'AI recommendations generated successfully.', result);
});

/**
 * POST /api/v1/ai/generate-menu-item
 * AI Menu Item writer for restaurant owners.
 */
const generateMenuItem = catchAsync(async (req, res) => {
  const { name, cuisine } = req.body;
  const result = await aiService.generateMenuItemDetails(name, cuisine);
  sendSuccess(res, StatusCodes.OK, 'AI dish description generated successfully.', result);
});

module.exports = {
  recommendFood,
  generateMenuItem,
};
