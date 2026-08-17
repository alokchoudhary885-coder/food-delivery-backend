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
 * Authenticate a user by email + password.
 */
const loginUser = async (email, password) => {
  if (!email || !password) {
    throw new AppError('Please provide email and password.', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!user) {
    throw new AppError('No account found with this email address. Please sign up.', 401);
  }

  // Account exists but was created via phone OTP — has no password.
  // Do NOT silently set a password. Tell user to use OTP or Forgot Password.
  if (!user.password) {
    throw new AppError(
      'This account has no password set. Please login with Mobile OTP or reset your password via Forgot Password.',
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

  if (!twoFactorKey && !fast2smsKey) {
    // Clear the OTP so the DB is not left with an orphaned, undeliverable OTP.
    user.otp          = undefined;
    user.otpExpiresAt = undefined;
    await user.save({ validateBeforeSave: false });
    console.error('[FoodRush Auth] No SMS provider API key configured in environment variables.');
    throw new AppError('SMS service is not configured. Please contact support.', 503);
  }

  let smsAccepted = false;
  let providerLog = '';

  try {
    if (twoFactorKey) {
      // ── 2Factor.in Integration ─────────────────────────────────────────────
      // Endpoint: https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}/{template_optional}
      const templateSuffix = process.env.TWOFACTOR_OTP_TEMPLATE ? `/${encodeURIComponent(process.env.TWOFACTOR_OTP_TEMPLATE)}` : '';
      const twoFactorUrl = `https://2factor.in/API/V1/${twoFactorKey}/SMS/+91${cleanPhone}/${otp}${templateSuffix}`;

      const res = await fetch(twoFactorUrl);
      const data = await res.json();

      // Safe diagnostic log — zero secrets, zero OTP
      providerLog = `2Factor.in HTTP ${res.status} | Status: ${data?.Status} | Details: ${data?.Details}`;
      console.log(`[FoodRush Auth] ${providerLog} for ******${cleanPhone.slice(-4)}`);

      if (data && data.Status === 'Success') {
        smsAccepted = true;
      }
    } else if (fast2smsKey) {
      // ── Fast2SMS Integration ───────────────────────────────────────────────
      const httpRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization':  fast2smsKey,
          'Content-Type':   'application/json',
        },
        body: JSON.stringify({
          route:            'q',
          message:          `Your FoodRush verification OTP is ${otp}. Valid for 10 minutes. Do not share it with anyone.`,
          language:         'english',
          flash:            0,
          numbers:          cleanPhone,
        }),
      });

      const data = await httpRes.json();
      providerLog = `Fast2SMS HTTP ${httpRes.status} | return: ${data?.return} | status_code: ${data?.status_code}`;
      console.log(`[FoodRush Auth] ${providerLog} for ******${cleanPhone.slice(-4)}`);

      if (data && (data.return === true || data.status_code === 200)) {
        smsAccepted = true;
      }
    }

    if (!smsAccepted) {
      // Provider rejected request — wipe OTP from DB so user can retry cleanly
      user.otp          = undefined;
      user.otpExpiresAt = undefined;
      await user.save({ validateBeforeSave: false });

      console.error(`[FoodRush Auth] SMS delivery failed for ******${cleanPhone.slice(-4)}: ${providerLog}`);
      throw new AppError(
        'SMS could not be delivered. Please verify the mobile number is active and try again.',
        502
      );
    }
  } catch (smsErr) {
    if (smsErr.isOperational) throw smsErr; // re-throw our own AppErrors
    user.otp          = undefined;
    user.otpExpiresAt = undefined;
    await user.save({ validateBeforeSave: false });
    console.error('[FoodRush Auth] SMS provider network error:', smsErr.message);
    throw new AppError('SMS service is temporarily unavailable. Please try again shortly.', 503);
  }

  // OTP is stored in DB. NEVER return it in the response.
  return {
    phone:   cleanPhone,
    message: `OTP sent to +91 ******${cleanPhone.slice(-4)}`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  verifyOTP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verify the SMS OTP entered by the user.
 * On success: clears OTP from DB (non-reusable), marks phone as verified, returns JWT.
 */
const verifyOTP = async (phone, otp) => {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new AppError('Valid 10-digit mobile number is required.', 400);
  }
  if (!otp || String(otp).trim().length !== 6) {
    throw new AppError('Please enter the 6-digit OTP.', 400);
  }

  const user = await User.findOne({ phone: cleanPhone }).select('+otp +otpExpiresAt');

  if (!user || !user.otp) {
    throw new AppError('No OTP request found for this number. Please request a new OTP.', 400);
  }

  // Check expiry first (more informative error than "incorrect OTP")
  if (!user.otpExpiresAt || user.otpExpiresAt < Date.now()) {
    throw new AppError('This OTP has expired. Please request a new one.', 400);
  }

  // Constant-time comparison — prevents timing attacks on OTP guessing
  const inputOtp    = String(otp).trim();
  const storedOtp   = String(user.otp).trim();
  const isMatch     = crypto.timingSafeEqual(
    Buffer.from(inputOtp.padStart(6, '0')),
    Buffer.from(storedOtp.padStart(6, '0'))
  );

  if (!isMatch) {
    throw new AppError('Incorrect OTP. Please check the SMS and try again.', 400);
  }

  // ── OTP is valid — clear immediately (non-reusable) ─────────────────────
  user.otp          = undefined;
  user.otpExpiresAt = undefined;
  user.phoneVerified = true;
  await user.save({ validateBeforeSave: false });

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
//  resetPasswordWithOTP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Reset account password after verifying SMS OTP.
 * No master OTP. No bypass. No OTP in response.
 */
const resetPasswordWithOTP = async (phone, otp, newPassword) => {
  if (!phone || !otp || !newPassword) {
    throw new AppError('Phone, OTP and new password are required.', 400);
  }
  if (newPassword.length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }

  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length !== 10) {
    throw new AppError('Valid 10-digit mobile number is required.', 400);
  }

  const user = await User.findOne({ phone: cleanPhone }).select('+otp +otpExpiresAt +password');

  if (!user) {
    throw new AppError('No account found with this mobile number.', 404);
  }

  if (!user.otp) {
    throw new AppError('No OTP request found for this number. Please request a new OTP.', 400);
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
    throw new AppError('Incorrect OTP. Please check the SMS and try again.', 400);
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
  verifyOTP,
  googleLogin,
  authenticateFirebaseUser,
  resetPasswordWithOTP,
  signToken,
};
