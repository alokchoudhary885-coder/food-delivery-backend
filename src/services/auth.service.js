/**
 * @file src/services/auth.service.js
 * @description Authentication business logic.
 * Controllers call these functions and handle HTTP response.
 * Services focus purely on data and logic — no req/res objects here.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');

/**
 * Generate a signed JWT token for a user ID.
 * @param {string} userId
 * @returns {string} JWT token
 */
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Register a new user.
 * @param {object} data - { name, email, password, role, phone }
 * @returns {{ user: object, token: string }}
 */
const registerUser = async (data) => {
  // Check for duplicate email
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const user = await User.create(data);
  const token = signToken(user._id);

  // Remove password from response
  user.password = undefined;

  return { user, token };
};

/**
 * Authenticate a user by email and password.
 * @param {string} email
 * @param {string} password
 * @returns {{ user: object, token: string }}
 */
const loginUser = async (email, password) => {
  // Explicitly select password since it has select: false in schema
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    // Intentionally vague message to prevent user enumeration
    throw new AppError('Incorrect email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact support.', 401);
  }

  const token = signToken(user._id);
  user.password = undefined;

  return { user, token };
};

/**
 * Get authenticated user profile.
 * @param {string} userId
 * @returns {object} user
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) { throw new AppError('User not found.', 404); }
  return user;
};

/**
 * Update password for authenticated user.
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {{ user: object, token: string }}
 */
const updatePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect.', 401);
  }

  user.password = newPassword;
  await user.save(); // pre-save hook will hash the new password

  const token = signToken(user._id);
  user.password = undefined;

  return { user, token };
};

/**
 * Send OTP to mobile number.
 * @param {string} phone
 * @returns {{ phone: string, otp: string, message: string }}
 */
const sendOTP = async (phone) => {
  if (!phone || !/^[0-9]{10}$/.test(phone)) {
    throw new AppError('Valid 10-digit phone number is required.', 400);
  }

  // Generate 6-digit OTP (e.g. 123456 for fast testing, or random 6-digits)
  const otp = '123456';
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      name: `User_${phone.slice(-4)}`,
      phone,
      role: 'customer',
      otp,
      otpExpiresAt,
    });
  } else {
    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save({ validateBeforeSave: false });
  }

  return { phone, otp, message: 'OTP sent successfully' };
};

/**
 * Verify OTP and login or create user.
 * @param {string} phone
 * @param {string} otp
 * @returns {{ user: object, token: string }}
 */
const verifyOTP = async (phone, otp) => {
  if (!phone || !otp) {
    throw new AppError('Phone and OTP are required.', 400);
  }

  const user = await User.findOne({ phone }).select('+otp +otpExpiresAt');

  if (!user || user.otp !== otp || user.otpExpiresAt < Date.now()) {
    throw new AppError('Invalid or expired OTP. Please request a new one.', 400);
  }

  user.otp = undefined;
  user.otpExpiresAt = undefined;
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);

  return { user, token };
};

module.exports = { registerUser, loginUser, getMe, updatePassword, signToken, sendOTP, verifyOTP };
