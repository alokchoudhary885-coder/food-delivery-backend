/**
 * @file src/models/menuItem.model.js
 * @description Menu item schema.
 * Each item belongs to a restaurant and has a category, price, and availability flag.
 * Uses mongoose-paginate-v2 for paginated menu listing.
 */

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Menu item name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },

    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },

    category: {
      type: String,
      enum: {
        values: [
          'Starter', 'Main Course', 'Dessert', 'Beverage', 'Beverages',
          'Bread', 'Rice', 'Salad', 'Combo', 'Sides', 'Other',
        ],
        message: '{VALUE} is not a valid category',
      },
      default: 'Main Course',
    },

    image: {
      type: String,
      default: null,
    },

    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Menu item must belong to a restaurant'],
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    isVeg: {
      type: Boolean,
      default: false, // Vegetarian flag — important for Indian food delivery apps
    },

    // Spice level: useful for filtering
    spiceLevel: {
      type: String,
      enum: ['mild', 'medium', 'hot', 'extra-hot'],
      default: 'mild',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
menuItemSchema.index({ restaurant: 1, isAvailable: 1 });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ name: 'text', description: 'text' }); // Full-text search

// ── Pagination plugin ──────────────────────────────────────────────────────
menuItemSchema.plugin(mongoosePaginate);

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

module.exports = MenuItem;
