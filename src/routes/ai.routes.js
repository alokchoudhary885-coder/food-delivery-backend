/**
 * @file src/routes/ai.routes.js
 * @description Routes for AI food recommendations and restaurant owner tools.
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

// POST /api/v1/ai/recommend - Public FoodieBot endpoint
router.post('/recommend', aiController.recommendFood);

// POST /api/v1/ai/generate-menu-item - Owner dish description generator
router.post('/generate-menu-item', aiController.generateMenuItem);

module.exports = router;
