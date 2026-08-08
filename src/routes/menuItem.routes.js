/**
 * @file src/routes/menuItem.routes.js
 * @description Standalone menu item routes (by item ID).
 *
 * These handle operations on a SINGLE menu item when you already know its ID:
 *   GET    /api/v1/menu/:id   → Get one item (public)
 *   PUT    /api/v1/menu/:id   → Update item (owner)
 *   DELETE /api/v1/menu/:id   → Delete item (owner)
 *
 * NOTE: The nested POST/GET for a restaurant's full menu is handled inside
 *       restaurant.routes.js at /:restaurantId/menu → menu.routes.js
 *       This separation avoids Express param-merging conflicts.
 */

const express = require('express');
const menuController = require('../controllers/menu.controller');
const { protect, restrictTo, validate } = require('../middlewares/auth.middleware');
const { updateMenuItemSchema } = require('../validators/menu.validator');

const router = express.Router();

router
  .route('/:id')
  .get(menuController.getMenuItemById)
  .put(protect, restrictTo('owner', 'admin'), validate(updateMenuItemSchema), menuController.updateMenuItem)
  .delete(protect, restrictTo('owner', 'admin'), menuController.deleteMenuItem);

module.exports = router;
