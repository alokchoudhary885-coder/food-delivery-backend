/**
 * @file src/controllers/payment.controller.js
 * @description Razorpay payment route handlers.
 */

const { StatusCodes } = require('http-status-codes');
const paymentService  = require('../services/payment.service');
const catchAsync      = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

/**
 * POST /api/v1/payments/create-order
 * @desc   Creates a Razorpay order for an existing DB order.
 * @access Private (customer)
 *
 * Body: { orderId }
 *
 * Response includes:
 *  - razorpayOrder.id  → use in Razorpay checkout
 *  - key_id            → use in Razorpay checkout
 *  - grandTotal        → amount to display to user
 */
const createRazorpayOrder = catchAsync(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'fail',
      message: 'orderId is required in request body.',
    });
  }

  const result = await paymentService.createRazorpayOrder(orderId, req.user._id);

  sendSuccess(res, StatusCodes.CREATED, 'Razorpay order created successfully.', {
    razorpayOrderId: result.razorpayOrder.id,
    amount:          result.razorpayOrder.amount,       // in paise
    amountInRupees:  result.grandTotal,                 // in ₹ (for display)
    currency:        result.razorpayOrder.currency,
    key_id:          result.key_id,                     // frontend needs this
    // Frontend usage:
    // const rzp = new Razorpay({ key: key_id });
    // rzp.open({ order_id: razorpayOrderId, amount, currency });
  });
});

/**
 * POST /api/v1/payments/verify
 * @desc   Verifies Razorpay payment signature and marks order as paid.
 * @access Private (customer)
 *
 * Body: {
 *   orderId,             ← our MongoDB order _id
 *   razorpayOrderId,     ← from Razorpay (order_XXXXXX)
 *   razorpayPaymentId,   ← from Razorpay (pay_XXXXXX)
 *   razorpaySignature    ← from Razorpay (HMAC-SHA256 hex string)
 * }
 */
const verifyPayment = catchAsync(async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  // Basic validation
  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'fail',
      message: 'orderId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are all required.',
    });
  }

  const order = await paymentService.verifyPayment(
    { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature },
    req.user._id
  );

  sendSuccess(res, StatusCodes.OK, '✅ Payment verified successfully. Order confirmed!', {
    order: {
      _id:             order._id,
      status:          order.status,
      paymentStatus:   order.paymentStatus,
      razorpayPaymentId: order.razorpayPaymentId,
      grandTotal:      order.grandTotal,
      confirmedAt:     order.confirmedAt,
    },
  });
});

module.exports = {
  createRazorpayOrder,
  verifyPayment,
};
