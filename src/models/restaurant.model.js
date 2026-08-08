/**
 * @file src/models/restaurant.model.js
 * @description Restaurant schema.
 * Each restaurant belongs to an owner (User with role='owner').
 */

const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Restaurant must have an owner'],
    },

    cuisine: {
      type: [String],
      required: [true, 'At least one cuisine type is required'],
      enum: [
        'Indian', 'Chinese', 'Italian', 'Mexican', 'American',
        'Japanese', 'Thai', 'Mediterranean', 'FastFood', 'Bakery',
        'Beverages', 'Desserts', 'Other',
      ],
    },

    address: {
      street: { type: String, required: [true, 'Street address is required'], trim: true },
      city:   { type: String, required: [true, 'City is required'], trim: true },
      state:  { type: String, required: [true, 'State is required'], trim: true },
      pincode: { type: String, required: [true, 'Pincode is required'], trim: true },
    },

    phone: {
      type: String,
      required: [true, 'Restaurant phone number is required'],
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number'],
    },

    image: {
      type: String, // URL to the uploaded image (Cloudinary / S3 in production)
      default: 'https://placehold.co/600x400?text=Restaurant',
    },

    isActive: {
      type: Boolean,
      default: true, // Owner can temporarily close the restaurant
    },

    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
    },

    totalRatings: {
      type: Number,
      default: 0,
    },

    // Average delivery time in minutes
    deliveryTime: {
      type: Number,
      default: 30,
      min: [5, 'Delivery time cannot be less than 5 minutes'],
    },

    minimumOrder: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order cannot be negative'],
    },

    deliveryFee: {
      type: Number,
      default: 0,
      min: [0, 'Delivery fee cannot be negative'],
    },
  },
  {
    timestamps: true,
    // Add a virtual 'id' field (string version of _id) for frontend convenience
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: Menu items belonging to this restaurant ──────────────────────
// Populated on demand using .populate('menu')
restaurantSchema.virtual('menu', {
  ref: 'MenuItem',
  foreignField: 'restaurant',
  localField: '_id',
});

// ── Index for geo-search and common queries ────────────────────────────────
restaurantSchema.index({ 'address.city': 1, isActive: 1 });
restaurantSchema.index({ cuisine: 1 });
restaurantSchema.index({ owner: 1 });

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

module.exports = Restaurant;
