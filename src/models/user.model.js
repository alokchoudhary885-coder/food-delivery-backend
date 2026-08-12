/**
 * @file src/models/user.model.js
 * @description User schema — supports Customer, Restaurant Owner, and Admin roles.
 *
 * Key design decisions:
 *  - Password is hashed BEFORE saving using a pre-save hook (not in the controller)
 *  - comparePassword() is an instance method — password logic lives in the model
 *  - passwordChangedAt tracks when password was last changed (for JWT invalidation)
 *  - select: false on password means it is NEVER returned in queries by default
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },

    otp: {
      type: String,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: ['customer', 'owner', 'admin'],
        message: 'Role must be customer, owner, or admin',
      },
      default: 'customer',
    },

    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number'],
    },

    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    auth_provider: {
      type: String,
      enum: ['email', 'google', 'phone'],
      default: 'email',
    },

    avatar: {
      type: String,
      default: '',
    },

    // Used to invalidate JWTs issued before a password change
    passwordChangedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ── Pre-save Hook: Hash password before saving ─────────────────────────────
// Only runs if the password field was modified (avoids re-hashing on other updates)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) { return next(); }

  // Salt rounds: 12 is the industry standard balance of security vs. speed
  this.password = await bcrypt.hash(this.password, 12);

  // Set passwordChangedAt for JWT invalidation logic
  if (!this.isNew) {
    // Subtract 1 second to handle token-issue timing edge case
    this.passwordChangedAt = Date.now() - 1000;
  }

  next();
});

// ── Instance Method: Compare plain password with stored hash ───────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Instance Method: Check if password changed after a JWT was issued ──────
userSchema.methods.changedPasswordAfter = function (jwtIssuedAt) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtIssuedAt < changedTimestamp; // true = password changed after token issued
  }
  return false; // Password never changed
};

const User = mongoose.model('User', userSchema);

module.exports = User;
