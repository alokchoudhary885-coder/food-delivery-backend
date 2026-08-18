/**
 * @file src/middlewares/auth.middleware.js
 * @description JWT authentication and role-based authorization middleware.
 *
 * protect()     → Verifies the JWT token, attaches req.user
 * restrictTo()  → Checks if the authenticated user has the required role(s)
 * validate()    → Runs a Joi schema against req.body and calls next(AppError) on failure
 */

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const firebaseAdmin = require('../config/firebase-admin');

// ── protect ───────────────────────────────────────────────────────────────
// Must run on every protected route BEFORE the controller.
// Verifies Firebase ID Tokens (with checkRevoked) and JWT tokens server-side.
const protect = catchAsync(async (req, _res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required. Please log in to continue.', 401));
  }

  let currentUser = null;

  // 1. Try Firebase Admin Server-Side Verification (with checkRevoked = true)
  const existingApps = firebaseAdmin.getApps ? firebaseAdmin.getApps() : (firebaseAdmin.apps || []);
  if (existingApps.length) {
    try {
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token, true);
      const uid = decodedToken.uid;
      const email = decodedToken.email;
      const phone = decodedToken.phone_number ? decodedToken.phone_number.replace(/\D/g, '').slice(-10) : null;

      let query = { firebaseUid: uid };
      if (email) query = { $or: [{ firebaseUid: uid }, { email: email.toLowerCase() }] };
      else if (phone) query = { $or: [{ firebaseUid: uid }, { phone }] };

      currentUser = await User.findOne(query);

      if (!currentUser) {
        currentUser = await User.create({
          firebaseUid: uid,
          name: decodedToken.name || (email ? email.split('@')[0] : `Customer_${phone?.slice(-4) || 'User'}`),
          email: email ? email.toLowerCase() : undefined,
          phone: phone || undefined,
          avatar: decodedToken.picture || '',
          emailVerified: !!decodedToken.email_verified,
          phoneVerified: !!decodedToken.phone_number,
          auth_provider: decodedToken.firebase?.sign_in_provider === 'google.com' ? 'google' : phone ? 'phone' : 'email',
          role: 'customer',
        });
      } else {
        if (!currentUser.firebaseUid) currentUser.firebaseUid = uid;
        if (decodedToken.email_verified) currentUser.emailVerified = true;
        if (decodedToken.phone_number) currentUser.phoneVerified = true;
        await currentUser.save({ validateBeforeSave: false });
      }

      req.firebaseToken = decodedToken;
    } catch (fbErr) {
      if (fbErr.code === 'auth/id-token-revoked') {
        return next(new AppError('Your session has been revoked. Please log in again.', 401));
      }
      // If Firebase verification fails, fall through to JWT verification
    }
  }

  // 2. Fallback JWT Signature Verification
  if (!currentUser) {
    let decoded;
    try {
      const secret = process.env.JWT_SECRET || 'foodrush_production_jwt_secure_secret_key_2026_x99';
      decoded = jwt.verify(token, secret);
      currentUser = await User.findById(decoded.id);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your session has expired. Please log in again.', 401));
      }
      return next(new AppError('Invalid authentication token. Please log in again.', 401));
    }
  }

  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 401));
  }

  // Grant access: attach verified user to request
  req.user = currentUser;
  next();
});

// ── restrictTo ────────────────────────────────────────────────────────────
// Factory function — returns a middleware that checks allowed roles.
// Usage: router.delete('/...', protect, restrictTo('admin'), controller)
const restrictTo = (...roles) => {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }
    next();
  };
};

// ── validate ──────────────────────────────────────────────────────────────
// Middleware factory that validates req.body against a Joi schema.
// Usage: router.post('/register', validate(registerSchema), authController.register)
const validate = (schema) => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,   // Collect ALL validation errors, not just the first
      stripUnknown: true,  // Remove fields not defined in the schema
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return next(new AppError(message, 400));
    }

    // Replace req.body with the sanitized/validated value (unknown fields stripped)
    req.body = value;
    next();
  };
};

module.exports = { protect, restrictTo, validate };
