/**
 * @file src/routes/menu.routes.js
 * @description Menu item routes.
 *
 * Mounted at two places:
 *  1. /api/v1/restaurants/:restaurantId/menu  (nested — list + add)
 *  2. /api/v1/menu                            (standalone — get/update/delete by item ID)
 *
 * mergeParams: true allows this router to access :restaurantId from the parent router.
 */

const express = require('express');
const menuController = require('../controllers/menu.controller');
const { protect, restrictTo, validate } = require('../middlewares/auth.middleware');
const { createMenuItemSchema, updateMenuItemSchema } = require('../validators/menu.validator');

const router = express.Router({ mergeParams: true });

// ── Nested routes: /api/v1/restaurants/:restaurantId/menu ─────────────────
router
  .route('/')
  .get(menuController.getMenuByRestaurant)
  .post(protect, restrictTo('owner', 'admin'), validate(createMenuItemSchema), menuController.addMenuItem);

// ── Standalone routes: /api/v1/menu/:id ───────────────────────────────────
router
  .route('/:id')
  .get(menuController.getMenuItemById)
  .put(protect, restrictTo('owner', 'admin'), validate(updateMenuItemSchema), menuController.updateMenuItem)
  .delete(protect, restrictTo('owner', 'admin'), menuController.deleteMenuItem);

module.exports = router;
