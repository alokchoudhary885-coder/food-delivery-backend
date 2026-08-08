/**
 * @file src/routes/payment.routes.js
 * @description Razorpay payment routes.
 *
 * POST /api/v1/payments/create-order → Step 1: Create Razorpay order
 * POST /api/v1/payments/verify       → Step 2: Verify payment & confirm order
 */

const express           = require('express');
const paymentController = require('../controllers/payment.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

// All payment routes require authentication
router.use(protect);

/**
 * Step 1 — Initiate payment
 * Customer calls this after placing an order with paymentMethod: "online"
 * Returns razorpayOrderId + key_id needed to open Razorpay checkout
 */
router.post(
  '/create-order',
  restrictTo('customer'),
  paymentController.createRazorpayOrder
);

/**
 * Step 2 — Verify payment
 * Called after Razorpay checkout succeeds on frontend
 * Validates signature and marks order as paid + confirmed
 */
router.post(
  '/verify',
  restrictTo('customer'),
  paymentController.verifyPayment
);

module.exports = router;
