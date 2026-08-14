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
  const secret = process.env.JWT_SECRET || 'foodrush_jwt_secret_key_production_2026';
  return jwt.sign({ id: userId }, secret, {
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
 * Send real OTP to mobile number via Fast2SMS / SMS gateway.
 * @param {string} phone
 * @returns {{ phone: string, message: string }}
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

  // Dispatch real SMS to Indian mobile carrier if FAST2SMS_API_KEY is configured
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey) {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': fast2smsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: phone,
        }),
      });
      const data = await response.json();
      console.log(`📲 Fast2SMS real SMS dispatched to +91 ${phone}:`, data);
    } catch (smsErr) {
      console.error('⚠️ Fast2SMS dispatch error:', smsErr.message);
    }
  } else {
    console.log(`ℹ️ [FoodRush SMS] Generated OTP for +91 ${phone}: ${otp}`);
  }

  // Never return otp in production response to frontend!
  return { phone, message: 'OTP sent successfully to your mobile number' };
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
 * Process authenticated user identity from real production auth provider (Firebase / Google / Phone OTP).
 * @param {object} payload { email, phone, name, avatar, authProvider, uid }
 * @returns {{ user: object, token: string }}
 */
const authenticateFirebaseUser = async (payload) => {
  const { email, phone, name, avatar, authProvider } = payload;

  let query = {};
  if (email) {
    query.email = email.toLowerCase().trim();
  } else if (phone) {
    // Strip +91 or country code if needed for 10-digit matching
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    query.phone = cleanPhone;
  } else {
    throw new AppError('Valid email or phone number is required from auth provider.', 400);
  }

  let user = await User.findOne(query);

  if (!user) {
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : undefined;
    user = await User.create({
      name: name || (email ? email.split('@')[0] : `Customer_${cleanPhone?.slice(-4) || 'User'}`),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: cleanPhone,
      avatar: avatar || '',
      auth_provider: authProvider || (email ? 'google' : 'phone'),
      role: 'customer',
    });
  } else {
    // Update profile info if missing
    if (avatar && !user.avatar) user.avatar = avatar;
    if (authProvider && !user.auth_provider) user.auth_provider = authProvider;
    if (name && user.name.startsWith('Customer_')) user.name = name;
    await user.save({ validateBeforeSave: false });
  }

  const token = signToken(user._id);
  user.password = undefined;

  return { user, token };
};

/**
 * Legacy Google login handler.
 */
const googleLogin = async (payload) => {
  return authenticateFirebaseUser({ ...payload, authProvider: 'google' });
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updatePassword,
  signToken,
  sendOTP,
  verifyOTP,
  googleLogin,
  authenticateFirebaseUser,
};
