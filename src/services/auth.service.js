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
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Cannot issue token.');
  }
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
  const email = data.email ? data.email.toLowerCase().trim() : undefined;
  const cleanPhone = data.phone ? data.phone.replace(/\D/g, '').slice(-10) : undefined;

  if (email) {
    const existing = await User.findOne({ email }).select('+password');
    if (existing) {
      if (data.password && (!existing.password || existing.auth_provider !== 'email')) {
        existing.password = data.password;
        if (data.name) existing.name = data.name;
        if (cleanPhone) existing.phone = cleanPhone;
        if (data.role) existing.role = data.role;
        existing.auth_provider = 'email';
        await existing.save();
        const token = signToken(existing._id);
        existing.password = undefined;
        return { user: existing, token };
      }
      throw new AppError('An account with this email already exists. Please login instead.', 409);
    }
  }

  const user = await User.create({
    name: data.name,
    email,
    password: data.password,
    role: data.role || 'customer',
    phone: cleanPhone,
    auth_provider: 'email',
  });

  const token = signToken(user._id);
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
  if (!email || !password) {
    throw new AppError('Please provide email and password.', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!user) {
    throw new AppError('No account found with this email address. Please sign up.', 401);
  }

  if (!user.password) {
    // This account was created via phone OTP and has no password set.
    // Direct them to set a password via Forgot Password, or log in with OTP.
    throw new AppError('This account has no password set. Please use Mobile OTP login or reset your password via Forgot Password.', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Incorrect password. Please try again or use Forgot Password.', 401);
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
  await user.save();

  const token = signToken(user._id);
  user.password = undefined;

  return { user, token };
};

/**
 * Send 6-digit OTP to Indian mobile number (+91).
 * @param {string} phone - 10-digit mobile number
 * @returns {object} result
 */
const sendOTP = async (phone) => {
  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new AppError('Valid 10-digit Indian mobile number is required.', 400);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  let user = await User.findOne({ phone: cleanPhone });
  if (!user) {
    user = await User.create({
      name: `Customer_${cleanPhone.slice(-4)}`,
      phone: cleanPhone,
      role: 'customer',
      otp,
      otpExpiresAt,
      auth_provider: 'phone',
    });
  } else {
    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save({ validateBeforeSave: false });
  }

  // Dispatch real SMS via Fast2SMS if configured
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  let smsSent = false;

  if (!fast2smsKey) {
    // FAST2SMS_API_KEY not configured — SMS cannot be sent.
    // Set this variable in Render → Environment Variables.
    console.error('[FoodRush Auth] FAST2SMS_API_KEY is not set. SMS not sent for phone: ******' + cleanPhone.slice(-4));
    throw new AppError('SMS service is not configured. Please contact support.', 503);
  }

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
        numbers: cleanPhone,
      }),
    });

    const data = await response.json();

    // Log Fast2SMS HTTP status and return value for diagnostics — no OTP or key logged
    console.log(`[FoodRush Auth] Fast2SMS HTTP ${response.status} for ******${cleanPhone.slice(-4)} — return: ${data?.return}, status_code: ${data?.status_code}, message: ${JSON.stringify(data?.message)}`);

    if (data && (data.return === true || data.status_code === 200)) {
      smsSent = true;
    } else {
      // Fast2SMS accepted the request but reported failure (e.g. DLT issue, invalid number)
      console.error(`[FoodRush Auth] Fast2SMS rejected for ******${cleanPhone.slice(-4)}: ${JSON.stringify(data)}`);
      throw new AppError('SMS could not be delivered. Please check the mobile number and try again.', 502);
    }
  } catch (smsErr) {
    if (smsErr.isOperational) throw smsErr; // re-throw our own AppErrors
    console.error('[FoodRush Auth] Fast2SMS network error:', smsErr.message);
    throw new AppError('SMS service is temporarily unavailable. Please try again shortly.', 503);
  }

  // OTP is stored in DB. Never return it in the response.
  return {
    phone: cleanPhone,
    message: `OTP sent to +91 ******${cleanPhone.slice(-4)}`,
  };
};

/**
 * Verify OTP and login or create user.
 * @param {string} phone
 * @param {string} otp
 * @returns {{ user: object, token: string }}
 */
const verifyOTP = async (phone, otp) => {
  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
  if (!cleanPhone || !otp) {
    throw new AppError('Phone and OTP are required.', 400);
  }

  let user = await User.findOne({ phone: cleanPhone }).select('+otp +otpExpiresAt');

  if (!user || !user.otp) {
    throw new AppError('No OTP request found for this number. Please request a new OTP.', 400);
  }

  const isExpired = !user.otpExpiresAt || user.otpExpiresAt < Date.now();
  if (isExpired) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  if (user.otp !== otp) {
    throw new AppError('Incorrect OTP. Please check the SMS and try again.', 400);
  }

  // OTP is valid — clear it and mark phone as verified
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  user.phoneVerified = true;
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);

  return { user, token };
};

/**
 * Process authenticated user identity from real auth providers.
 * @param {object} payload { email, phone, name, avatar, authProvider, password, role }
 * @returns {{ user: object, token: string }}
 */
const authenticateFirebaseUser = async (payload) => {
  const { email, phone, name, avatar, authProvider, password, role } = payload;

  let query = {};
  if (email) {
    query.email = email.toLowerCase().trim();
  } else if (phone) {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    query.phone = cleanPhone;
  } else {
    throw new AppError('Valid email or phone number is required.', 400);
  }

  let user = await User.findOne(query).select('+password');

  if (!user) {
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : undefined;
    user = await User.create({
      name: name || (email ? email.split('@')[0] : `Customer_${cleanPhone?.slice(-4) || 'User'}`),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: cleanPhone,
      password: password || undefined,
      avatar: avatar || '',
      auth_provider: authProvider || (email ? 'google' : 'phone'),
      role: role || 'customer',
    });
  } else {
    if (avatar && !user.avatar) user.avatar = avatar;
    if (authProvider && !user.auth_provider) user.auth_provider = authProvider;
    if (role && (role === 'owner' || role === 'customer')) user.role = role;
    if (name && (user.name.startsWith('Customer_') || !user.name)) user.name = name;
    if (password && !user.password) {
      user.password = password;
    }
    await user.save({ validateBeforeSave: false });
  }

  const token = signToken(user._id);
  user.password = undefined;

  return { user, token };
};

/**
 * Reset password using verified SMS OTP.
 * @param {string} phone
 * @param {string} otp
 * @param {string} newPassword
 * @returns {{ user: object, token: string }}
 */
const resetPasswordWithOTP = async (phone, otp, newPassword) => {
  if (!phone || !otp || !newPassword) {
    throw new AppError('Phone, OTP and new password are required.', 400);
  }
  if (newPassword.length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  let user = await User.findOne({ phone: cleanPhone }).select('+otp +otpExpiresAt +password');

  if (!user) {
    throw new AppError('No account found with this mobile number.', 404);
  }

  if (!user.otp) {
    throw new AppError('No OTP request found for this number. Please request a new OTP.', 400);
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < Date.now()) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  if (user.otp !== otp) {
    throw new AppError('Incorrect OTP. Please check the SMS and try again.', 400);
  }

  user.password = newPassword;
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const token = signToken(user._id);
  user.password = undefined;

  return { user, token };
};

/**
 * Google login via idToken — delegates to authenticateFirebaseUser.
 * @param {object} body - { email, name, avatar, authProvider, uid }
 * @returns {{ user: object, token: string }}
 */
const googleLogin = async (body) => {
  const { email, name, avatar, authProvider, uid } = body;
  if (!email) {
    throw new AppError('Email is required for Google login.', 400);
  }
  return authenticateFirebaseUser({ email, name, avatar, authProvider: authProvider || 'google', uid });
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
  resetPasswordWithOTP,
};

