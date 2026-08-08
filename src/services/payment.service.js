/**
 * @file src/services/payment.service.js
 * @description Razorpay payment business logic.
 *
 * Flow:
 *  1. createRazorpayOrder  → creates a Razorpay order linked to our DB order
 *  2. verifyPayment        → validates HMAC-SHA256 signature from Razorpay
 */

const crypto  = require('crypto');
const Razorpay = require('razorpay');
const Order   = require('../models/order.model');
const AppError = require('../utils/AppError');

// ── Razorpay SDK instance ─────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Step 1: Create a Razorpay order for an existing DB order.
 *
 * @param {string} orderId  - Our internal MongoDB Order _id
 * @param {string} userId   - Requesting user's _id (must be the customer)
 * @returns {{ razorpayOrder, dbOrder, key_id }}
 */
const createRazorpayOrder = async (orderId, userId) => {
  // 1. Find our DB order
  const dbOrder = await Order.findById(orderId);
  if (!dbOrder) {
    throw new AppError('Order not found.', 404);
  }

  // 2. Only the customer who placed the order can pay for it
  if (dbOrder.customer.toString() !== userId.toString()) {
    throw new AppError('You are not authorized to pay for this order.', 403);
  }

  // 3. Only pending orders can be paid
  if (dbOrder.paymentStatus === 'paid') {
    throw new AppError('This order has already been paid.', 400);
  }

  // 4. Only online payment methods can use Razorpay
  if (dbOrder.paymentMethod === 'cash_on_delivery') {
    throw new AppError(
      'This order is set to cash on delivery. Change paymentMethod to "online" to pay online.',
      400
    );
  }

  // 5. Create Razorpay order (amount is in paise: ₹648 → 64800)
  const razorpayOrder = await razorpay.orders.create({
    amount:   Math.round(dbOrder.grandTotal * 100), // convert ₹ to paise
    currency: 'INR',
    receipt:  `order_${orderId}`,
    notes: {
      dbOrderId:    orderId,
      customerName: userId,
    },
  });

  // 6. Save razorpayOrderId on our DB order (for verification later)
  dbOrder.razorpayOrderId = razorpayOrder.id;
  await dbOrder.save();

  return {
    razorpayOrder,             // full Razorpay order object
    grandTotal: dbOrder.grandTotal,
    key_id: process.env.RAZORPAY_KEY_ID,  // frontend needs this to open checkout
  };
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Step 2: Verify payment signature from Razorpay and mark order as paid.
 *
 * Razorpay sends 3 values after payment:
 *  - razorpay_order_id   (the Razorpay order ID we created in step 1)
 *  - razorpay_payment_id (new payment ID generated after successful payment)
 *  - razorpay_signature  (HMAC-SHA256 to verify authenticity)
 *
 * @param {{ razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId }} data
 * @param {string} userId
 * @returns {Order} updated order
 */
const verifyPayment = async (data, userId) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = data;

  // 1. Verify HMAC-SHA256 signature
  //    Expected signature = HMAC_SHA256(razorpayOrderId + "|" + razorpayPaymentId, key_secret)
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    throw new AppError('Invalid payment signature. Payment verification failed.', 400);
  }

  // 2. Find our DB order and confirm it belongs to this user
  const dbOrder = await Order.findById(orderId);
  if (!dbOrder) throw new AppError('Order not found.', 404);
  if (dbOrder.customer.toString() !== userId.toString()) {
    throw new AppError('Not authorized.', 403);
  }

  // Note: HMAC-SHA256 signature (step 1) already cryptographically binds
  // razorpayOrderId + razorpayPaymentId — no secondary DB check needed.

  // 3. Mark order as paid and auto-confirm it

  dbOrder.paymentStatus    = 'paid';
  dbOrder.razorpayPaymentId = razorpayPaymentId;
  dbOrder.razorpaySignature = razorpaySignature;
  dbOrder.status           = 'confirmed'; // auto-confirm on payment
  dbOrder.confirmedAt      = new Date();
  await dbOrder.save();

  return dbOrder;
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
};
