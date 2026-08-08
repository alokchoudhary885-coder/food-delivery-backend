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

// ── protect ───────────────────────────────────────────────────────────────
// Must run on every protected route BEFORE the controller.
// Reads the token from the Authorization header (Bearer scheme).
const protect = catchAsync(async (req, _res, next) => {
  // 1. Check if Authorization header exists and has Bearer token
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
  }

  // 2. Verify token signature and expiration
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Please log in again.', 401));
  }

  // 3. Check if user still exists (token valid but user deleted)
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  // 4. Check if user is still active
  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 401));
  }

  // 5. Check if password was changed after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password was recently changed. Please log in again.', 401));
  }

  // Grant access: attach user to request for downstream middleware/controllers
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
