/**
 * @file src/models/review.model.js
 * @description Review and rating schema for restaurants.
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Review must belong to a restaurant'],
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate review for the same order if order is provided
reviewSchema.index({ user: 1, order: 1 }, { unique: true, sparse: true });
reviewSchema.index({ restaurant: 1, createdAt: -1 });

// Helper to recalculate average rating on restaurant
reviewSchema.statics.calcAverageRating = async function (restaurantId) {
  const stats = await this.aggregate([
    { $match: { restaurant: restaurantId } },
    {
      $group: {
        _id: '$restaurant',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  const Restaurant = mongoose.model('Restaurant');
  if (stats.length > 0) {
    await Restaurant.findByIdAndUpdate(restaurantId, {
      rating: Math.round(stats[0].avgRating * 10) / 10,
      totalRatings: stats[0].nRating,
    });
  } else {
    await Restaurant.findByIdAndUpdate(restaurantId, {
      rating: 0,
      totalRatings: 0,
    });
  }
};

reviewSchema.post('save', function () {
  this.constructor.calcAverageRating(this.restaurant);
});

reviewSchema.post('remove', function () {
  this.constructor.calcAverageRating(this.restaurant);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
