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

  // Generate dynamic 6-digit OTP (e.g. 482910)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      name: `Customer_${phone.slice(-4)}`,
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

  // Allow test master OTP '123456' or exact generated OTP
  const isValidOTP = user && (user.otp === otp || otp === '123456') && user.otpExpiresAt > Date.now();

  if (!user || !isValidOTP) {
    throw new AppError('Invalid or expired OTP. Please enter the correct OTP.', 400);
  }

  user.otp = undefined;
  user.otpExpiresAt = undefined;
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);

  return { user, token };
};

/**
 * Authenticate or register user via Google Auth.
 * @param {object} googleData { email, name, picture, googleId }
 * @returns {{ user: object, token: string }}
 */
const googleLogin = async (googleData) => {
  const { email, name } = googleData;
  if (!email) {
    throw new AppError('Google authentication failed: Email is required.', 400);
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: name || email.split('@')[0],
      email,
      role: 'customer',
      password: Math.random().toString(36).slice(-10) + 'A1!',
    });
  }

  const token = signToken(user._id);
  user.password = undefined;

  return { user, token };
};

module.exports = { registerUser, loginUser, getMe, updatePassword, signToken, sendOTP, verifyOTP, googleLogin };
