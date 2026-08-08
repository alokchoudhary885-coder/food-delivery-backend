/**
 * @file src/routes/order.routes.js
 * @description Order routes.
 *
 * POST  /api/v1/orders                              → Place order (customer)
 * GET   /api/v1/orders/my-orders                    → Customer's orders
 * GET   /api/v1/orders/restaurant/:restaurantId      → Restaurant's orders (owner)
 * GET   /api/v1/orders/:id                          → Single order
 * PATCH /api/v1/orders/:id/status                   → Update order status
 */

const express = require('express');
const orderController = require('../controllers/order.controller');
const { protect, restrictTo, validate } = require('../middlewares/auth.middleware');
const { createOrderSchema, updateOrderStatusSchema } = require('../validators/order.validator');

const router = express.Router();

// All order routes require authentication
router.use(protect);

router
  .route('/')
  .post(restrictTo('customer'), validate(createOrderSchema), orderController.placeOrder);

// Static paths before dynamic /:id
router.get('/my-orders', restrictTo('customer'), orderController.getMyOrders);
router.get('/restaurant/:restaurantId', restrictTo('owner', 'admin'), orderController.getRestaurantOrders);

router.get('/:id', orderController.getOrderById);
router.patch(
  '/:id/status',
  restrictTo('owner', 'admin', 'customer'),
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

module.exports = router;
