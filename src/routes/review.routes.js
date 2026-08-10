/**
 * @file src/routes/review.routes.js
 * @description Review routes.
 */

const express = require('express');
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/restaurant/:restaurantId', reviewController.getRestaurantReviews);

// Protected routes below
router.use(protect);
router.post('/', reviewController.createReview);

module.exports = router;
