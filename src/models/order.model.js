/**
 * @file src/models/order.model.js
 * @description Order schema.
 *
 * Order lifecycle (status field):
 *  pending → confirmed → preparing → out_for_delivery → delivered
 *                                                      → cancelled (at any stage before delivery)
 *
 * Each order stores a snapshot of item prices at the time of ordering.
 * This is critical: if a menu item's price changes later, the order record
 * should still reflect what the customer actually paid.
 */

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Sub-schema for each line item in the order
const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: {
      type: String,
      required: true, // Snapshot: item name at the time of order
    },
    price: {
      type: Number,
      required: true, // Snapshot: price at the time of order
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
  },
  { _id: false } // No separate _id for sub-documents
);

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a customer'],
    },

    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Order must belong to a restaurant'],
    },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (val) => val.length > 0,
        message: 'Order must have at least one item',
      },
    },

    // Snapshot of delivery address at time of order
    deliveryAddress: {
      street: { type: String, required: true },
      city:   { type: String, required: true },
      state:  { type: String, required: true },
      pincode: { type: String, required: true },
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
        message: '{VALUE} is not a valid order status',
      },
      default: 'pending',
    },

    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },

    deliveryFee: {
      type: Number,
      default: 0,
    },

    paymentMethod: {
      type: String,
      enum: ['cash_on_delivery', 'online'],
      default: 'cash_on_delivery',
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },

    // ── Razorpay fields ────────────────────────────────────────────────────
    // Filled in when customer initiates online payment
    razorpayOrderId: {
      type: String, // e.g. "order_XXXXXXXXXXXXXXXXXX"
    },
    // Filled in after successful payment & verification
    razorpayPaymentId: {
      type: String, // e.g. "pay_XXXXXXXXXXXXXXXXXX"
    },
    razorpaySignature: {
      type: String, // HMAC-SHA256 signature used for verification
    },
    // ──────────────────────────────────────────────────────────────────────

    // Optional: reason if order was cancelled
    cancellationReason: {

      type: String,
      trim: true,
    },

    // Timestamps for each status change (useful for delivery tracking)
    confirmedAt:      { type: Date },
    preparingAt:      { type: Date },
    outForDeliveryAt: { type: Date },
    deliveredAt:      { type: Date },
    cancelledAt:      { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: Grand total (items + delivery fee) ────────────────────────────
orderSchema.virtual('grandTotal').get(function () {
  return this.totalAmount + this.deliveryFee;
});

// ── Indexes ────────────────────────────────────────────────────────────────
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, status: 1 });
orderSchema.index({ status: 1 });

// ── Pagination plugin ──────────────────────────────────────────────────────
orderSchema.plugin(mongoosePaginate);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
