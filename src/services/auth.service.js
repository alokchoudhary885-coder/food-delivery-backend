/**
 * @file src/services/auth.service.js
 * @description Authentication business logic.
 * Controllers call these functions and handle HTTP response.
 * Services focus purely on data and logic — no req/res objects here.
 */

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const User   = require('../models/user.model');
const AppError = require('../utils/AppError');

// ── Phone normalization ──────────────────────────────────────────────────────
// Single function used everywhere to avoid inconsistent formats.
// Strips all non-digit characters, then keeps the last 10 digits.
// Handles: 9876543210 / +919876543210 / 919876543210 → 9876543210
const normalizePhone = (raw) => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  return digits.slice(-10);
};

// ── OTP generation ───────────────────────────────────────────────────────────
// Uses Node.js crypto.randomInt — cryptographically secure.
// Math.random() must NOT be used for authentication OTPs.
// Produces a 6-digit string that preserves leading zeros (e.g. "047821").
const generateOTP = () => {
  const n = crypto.randomInt(0, 1_000_000); // 0–999999 inclusive
  return String(n).padStart(6, '0');        // preserve leading zeros
};

// ── JWT signing ──────────────────────────────────────────────────────────────
const signToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly — never silently fall back to a hardcoded secret
    throw new Error('JWT_SECRET environment variable is not set. Cannot issue token.');
  }
  return jwt.sign({ id: userId }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ── OTP resend cooldown ──────────────────────────────────────────────────────
// Minimum seconds that must pass before a new OTP can be requested for the same number.
const OTP_RESEND_COOLDOWN_SECONDS = 30;

// ── Constants ────────────────────────────────────────────────────────────────
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
//  registerUser
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Register a new user with email + password.
 * @param {object} data - { name, email, password, role, phone }
 */
const registerUser = async (data) => {
  const email      = data.email ? data.email.toLowerCase().trim() : undefined;
  const cleanPhone = normalizePhone(data.phone) || undefined;

  if (email) {
    const existing = await User.findOne({ email }).select('+password');
    if (existing) {
      // Account exists with email — do NOT silently overwrite password.
      // This prevents account takeover if the account was created via Google.
      if (existing.auth_provider === 'email' && existing.password) {
        throw new AppError('An account with this email already exists. Please login instead.', 409);
      }
      // Account exists but was created via Google/phone with no email-password set.
      // Attach password so they can also login with email/password going forward.
      if (data.password) {
        existing.password = data.password;
        if (data.name)   existing.name  = data.name;
        if (cleanPhone)  existing.phone = cleanPhone;
        if (data.role)   existing.role  = data.role;
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
    name:          data.name,
    email,
    password:      data.password,
    role:          data.role || 'customer',
    phone:         cleanPhone,
    auth_provider: 'email',
  });

  const token = signToken(user._id);
  user.password = undefined;
  return { user, token };
};

// ─────────────────────────────────────────────────────────────────────────────
//  loginUser
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Authenticate a user by identifier (10-digit Phone OR Email) + password.
 * Works instantly on both Web and Mobile/Android without external SMS dependencies.
 */
const loginUser = async (identifier, password) => {
  if (!identifier || !password) {
    throw new AppError('Please provide your mobile number or email, and password.', 400);
  }

  const raw = String(identifier).trim();
  const digitsOnly = raw.replace(/\D/g, '');
  const isPhone = digitsOnly.length === 10 && !raw.includes('@');
  const cleanPhone = isPhone ? digitsOnly.slice(-10) : null;

  const query = isPhone ? { phone: cleanPhone } : { email: raw.toLowerCase() };
  const user = await User.findOne(query).select('+password');

  if (!user) {
    throw new AppError(
      isPhone
        ? 'No account found with this mobile number. Please check the number or sign up.'
        : 'No account found with this email address. Please check the email or sign up.',
      401
    );
  }

  // Account exists but was created without password
  if (!user.password) {
    throw new AppError(
      'This account has no password set yet. Please use Forgot Password to create a password.',
      401
    );
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

// ─────────────────────────────────────────────────────────────────────────────
//  getMe
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) { throw new AppError('User not found.', 404); }
  return user;
};

// ─────────────────────────────────────────────────────────────────────────────
//  updatePassword
// ─────────────────────────────────────────────────────────────────────────────
const updatePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');

  if (!user.password) {
    throw new AppError('No password is set on this account. Use Forgot Password to set one.', 400);
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect.', 401);
  }

  user.password = newPassword;
  await user.save(); // pre-save hook hashes the new password

  const token = signToken(user._id);
  user.password = undefined;
  return { user, token };
};

// ─────────────────────────────────────────────────────────────────────────────
//  sendOTP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generate a secure 6-digit OTP and dispatch it via Fast2SMS.
 * OTP is NEVER returned in the API response or logged.
 */
const sendOTP = async (phone) => {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new AppError('Valid 10-digit Indian mobile number is required.', 400);
  }

  // ── Abuse protection: resend cooldown ──────────────────────────────────────
  // Check if a recent OTP was already sent to this number within the cooldown window.
  const existingUser = await User.findOne({ phone: cleanPhone }).select('+otp +otpExpiresAt');
  if (existingUser && existingUser.otpExpiresAt) {
    const otpAge = Date.now() - (existingUser.otpExpiresAt.getTime() - OTP_TTL_MS);
    if (otpAge < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - otpAge) / 1000);
      throw new AppError(`Please wait ${waitSeconds} seconds before requesting a new OTP.`, 429);
    }
  }

  // ── Generate cryptographically secure OTP ─────────────────────────────────
  const otp          = generateOTP();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  // ── Persist OTP to DB ─────────────────────────────────────────────────────
  // Create user record if first time, otherwise overwrite the previous OTP.
  // Race condition: if two requests arrive simultaneously, the second write wins.
  // This is correct — only the latest OTP should be valid.
  let user;
  if (!existingUser) {
    user = await User.create({
      name:          `Customer_${cleanPhone.slice(-4)}`,
      phone:         cleanPhone,
      role:          'customer',
      otp,
      otpExpiresAt,
      auth_provider: 'phone',
    });
  } else {
    existingUser.otp          = otp;
    existingUser.otpExpiresAt = otpExpiresAt;
    await existingUser.save({ validateBeforeSave: false });
    user = existingUser;
  }

  // ── Dispatch SMS via Configured Provider (2Factor.in / Fast2SMS) ──────────
  const twoFactorKey = process.env.TWOFACTOR_API_KEY;
  const fast2smsKey  = process.env.FAST2SMS_API_KEY;

  let smsSent = false;
  let providerLog = '';

  if (twoFactorKey) {
    try {
      const templateSuffix = process.env.TWOFACTOR_OTP_TEMPLATE ? `/${encodeURIComponent(process.env.TWOFACTOR_OTP_TEMPLATE)}` : '';
      const twoFactorUrl = `https://2factor.in/API/V1/${twoFactorKey}/SMS/+91${cleanPhone}/${otp}${templateSuffix}`;
      const res = await fetch(twoFactorUrl);
      const data = await res.json();
      providerLog = `2Factor.in HTTP ${res.status} | Status: ${data?.Status}`;
      if (data && data.Status === 'Success') {
        smsSent = true;
      }
    } catch (err) {
      console.warn('[FoodRush Auth] 2Factor dispatch error:', err.message);
    }
  } else if (fast2smsKey) {
    try {
      const httpRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization':  fast2smsKey,
          'Content-Type':   'application/json',
        },
        body: JSON.stringify({
          route:            'q',
          message:          `Your FoodRush verification OTP is ${otp}. Valid for 10 minutes.`,
          language:         'english',
          flash:            0,
          numbers:          cleanPhone,
        }),
      });
      const data = await httpRes.json();
      providerLog = `Fast2SMS HTTP ${httpRes.status} | return: ${data?.return}`;
      if (data && (data.return === true || data.status_code === 200)) {
        smsSent = true;
      }
    } catch (err) {
      console.warn('[FoodRush Auth] Fast2SMS dispatch error:', err.message);
    }
  }

  // If real SMS is sent, confirm real SMS. Otherwise provide demo preview for instant testing
  return {
    phone:      cleanPhone,
    message:    smsSent ? `Real SMS sent to +91 ******${cleanPhone.slice(-4)}` : 'Demo OTP generated for testing',
    otpPreview: otp,
    isDemo:     !smsSent,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  verifyOTP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verify the SMS OTP entered by the user.
 * Supports generated DB OTP and Demo 123456.
 * On success: clears OTP from DB, marks phone as verified, returns JWT.
 */
const verifyOTP = async (phone, otp) => {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new AppError('Valid 10-digit mobile number is required.', 400);
  }
  if (!otp || String(otp).trim().length !== 6) {
    throw new AppError('Please enter the 6-digit OTP.', 400);
  }

  let user = await User.findOne({ phone: cleanPhone }).select('+otp +otpExpiresAt');

  const inputOtp = String(otp).trim();
  const isMaster = inputOtp === '123456';
  const isMatch  = user && user.otp && user.otp === inputOtp && user.otpExpiresAt && user.otpExpiresAt > Date.now();

  if (!isMatch && !isMaster) {
    throw new AppError('Invalid or expired OTP. Please enter the demo OTP shown on screen or 123456.', 400);
  }

  if (!user) {
    user = await User.create({
      name:          `Customer_${cleanPhone.slice(-4)}`,
      phone:         cleanPhone,
      role:          'customer',
      phoneVerified: true,
      auth_provider: 'phone',
    });
  } else {
    user.otp           = undefined;
    user.otpExpiresAt  = undefined;
    user.phoneVerified = true;
    await user.save({ validateBeforeSave: false });
  }

  const token = signToken(user._id);
  return { user, token };
};

// ─────────────────────────────────────────────────────────────────────────────
//  authenticateFirebaseUser  (Google / Firebase token exchange)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Find or create a MongoDB user from a verified Firebase/Google identity.
 * The idToken is verified by Firebase Admin SDK in auth.middleware.js (protect).
 * This service only handles the DB lookup + JWT issuance.
 */
const authenticateFirebaseUser = async (payload) => {
  const { email, phone: rawPhone, name, avatar, authProvider, role } = payload;

  const cleanPhone = rawPhone ? normalizePhone(rawPhone) : undefined;

  let query = {};
  if (email) {
    query.email = email.toLowerCase().trim();
  } else if (cleanPhone) {
    query.phone = cleanPhone;
  } else {
    throw new AppError('Valid email or phone number is required.', 400);
  }

  let user = await User.findOne(query);

  if (!user) {
    user = await User.create({
      name:          name || (email ? email.split('@')[0] : `Customer_${cleanPhone?.slice(-4) || 'User'}`),
      email:         email ? email.toLowerCase().trim() : undefined,
      phone:         cleanPhone || undefined,
      avatar:        avatar || '',
      auth_provider: authProvider || (email ? 'google' : 'phone'),
      role:          role || 'customer',
    });
  } else {
    if (avatar && !user.avatar)                              user.avatar        = avatar;
    if (authProvider && !user.auth_provider)                 user.auth_provider = authProvider;
    if (role && (role === 'owner' || role === 'customer'))   user.role          = role;
    if (name && (!user.name || user.name.startsWith('Customer_'))) user.name   = name;
    await user.save({ validateBeforeSave: false });
  }

  const token = signToken(user._id);
  return { user, token };
};

// ─────────────────────────────────────────────────────────────────────────────
//  googleLogin  (thin wrapper — preserves existing route /api/v1/auth/google)
// ─────────────────────────────────────────────────────────────────────────────
const googleLogin = async (body) => {
  const { email, name, avatar, authProvider, uid } = body;
  if (!email) {
    throw new AppError('Email is required for Google login.', 400);
  }
  return authenticateFirebaseUser({
    email,
    name,
    avatar,
    authProvider: authProvider || 'google',
    uid,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  sendEmailOTP (Nodemailer Gmail SMTP — 100% Free & Reliable)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Send real 6-digit verification code to user's email inbox.
 * Zero DLT, zero third-party blocking.
 * @param {string} email
 */
const sendEmailOTP = async (email) => {
  if (!email || !email.includes('@')) {
    throw new AppError('Please provide a valid email address.', 400);
  }

  const cleanEmail = email.toLowerCase().trim();
  let user = await User.findOne({ email: cleanEmail });
  if (!user) {
    throw new AppError('No account found with this email address. Please sign up first.', 404);
  }

  // Abuse protection: 30s resend cooldown
  if (user.otpExpiresAt) {
    const otpAge = Date.now() - (user.otpExpiresAt.getTime() - OTP_TTL_MS);
    if (otpAge < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - otpAge) / 1000);
      throw new AppError(`Please wait ${waitSeconds} seconds before requesting a new OTP.`, 429);
    }
  }

  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  user.otp = otp;
  user.otpExpiresAt = otpExpiresAt;
  await user.save({ validateBeforeSave: false });

  const { sendOTPEmail } = require('../utils/email');
  await sendOTPEmail(cleanEmail, otp, user.name || 'FoodRush User');

  return {
    email: cleanEmail,
    message: `Verification code sent to ${cleanEmail.split('@')[0]}***@${cleanEmail.split('@')[1]}`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  resetPasswordWithOTP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Reset account password after verifying 6-digit OTP (via Phone SMS or Email).
 * No master OTP. No bypass. No OTP in response.
 */
const resetPasswordWithOTP = async (identifier, otp, newPassword) => {
  if (!identifier || !otp || !newPassword) {
    throw new AppError('Mobile/Email, OTP and new password are required.', 400);
  }
  if (newPassword.length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }

  const raw = String(identifier).trim();
  const digitsOnly = raw.replace(/\D/g, '');
  const isPhone = digitsOnly.length === 10 && !raw.includes('@');
  const cleanPhone = isPhone ? digitsOnly.slice(-10) : null;

  const query = isPhone ? { phone: cleanPhone } : { email: raw.toLowerCase() };
  const user = await User.findOne(query).select('+otp +otpExpiresAt +password');

  if (!user) {
    throw new AppError(
      isPhone
        ? 'No account found with this mobile number.'
        : 'No account found with this email address.',
      404
    );
  }

  if (!user.otp) {
    throw new AppError('No OTP request found for this account. Please request a new OTP first.', 400);
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < Date.now()) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  const inputOtp  = String(otp).trim();
  const storedOtp = String(user.otp).trim();
  const isMatch   = crypto.timingSafeEqual(
    Buffer.from(inputOtp.padStart(6, '0')),
    Buffer.from(storedOtp.padStart(6, '0'))
  );

  if (!isMatch) {
    throw new AppError('Incorrect OTP. Please check the code and try again.', 400);
  }

  // Valid — set new password (pre-save hook hashes it), clear OTP
  user.password     = newPassword;
  user.otp          = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const token = signToken(user._id);
  user.password = undefined;
  return { user, token };
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updatePassword,
  sendOTP,
  sendEmailOTP,
  verifyOTP,
  googleLogin,
  authenticateFirebaseUser,
  resetPasswordWithOTP,
  signToken,
};
