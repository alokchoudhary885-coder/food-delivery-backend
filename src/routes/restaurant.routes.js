/**
 * @file src/routes/restaurant.routes.js
 * @description Restaurant CRUD routes.
 *
 * GET    /api/v1/restaurants                   → List all restaurants (public)
 * GET    /api/v1/restaurants/my-restaurants    → Get owner's restaurants (owner)
 * POST   /api/v1/restaurants                   → Create restaurant (owner)
 * GET    /api/v1/restaurants/:id               → Get single restaurant (public)
 * PUT    /api/v1/restaurants/:id               → Update restaurant (owner)
 * DELETE /api/v1/restaurants/:id               → Deactivate restaurant (admin)
 *
 * Also mounts menu sub-routes under /:restaurantId/menu
 */

const express = require('express');
const restaurantController = require('../controllers/restaurant.controller');
const { protect, restrictTo, validate } = require('../middlewares/auth.middleware');
const {
  createRestaurantSchema,
  updateRestaurantSchema,
} = require('../validators/restaurant.validator');

// Import menu router for nesting — mergeParams allows access to :restaurantId
const menuRouter = require('./menu.routes');

const router = express.Router();

// ── Nested menu routes ─────────────────────────────────────────────────────
// GET  /api/v1/restaurants/:restaurantId/menu
// POST /api/v1/restaurants/:restaurantId/menu
router.use('/:restaurantId/menu', menuRouter);

// ── Restaurant routes ──────────────────────────────────────────────────────
router
  .route('/')
  .get(restaurantController.getAllRestaurants)
  .post(protect, restrictTo('owner', 'admin'), validate(createRestaurantSchema), restaurantController.createRestaurant);

// IMPORTANT: /nearby and /my-restaurants must come BEFORE /:id to avoid being caught as an ID
router.get('/nearby', restaurantController.getNearbyRestaurants);
router.get('/my-restaurants', protect, restrictTo('owner'), restaurantController.getMyRestaurants);

router
  .route('/:id')
  .get(restaurantController.getRestaurantById)
  .put(protect, restrictTo('owner', 'admin'), validate(updateRestaurantSchema), restaurantController.updateRestaurant)
  .delete(protect, restrictTo('admin'), restaurantController.deleteRestaurant);

module.exports = router;
