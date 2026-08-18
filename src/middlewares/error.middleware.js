/**
 * @file src/middlewares/error.middleware.js
 * @description Centralized global error handling middleware.
 *
 * Handles specific Mongoose and JWT errors by transforming them into
 * user-friendly AppError instances before sending the response.
 *
 * Error types handled:
 *  - Mongoose CastError       → Invalid ObjectId format
 *  - Mongoose ValidationError → Schema validation failed
 *  - Mongoose Duplicate Key   → Unique constraint violation (code 11000)
 *  - JWT JsonWebTokenError    → Malformed token
 *  - JWT TokenExpiredError    → Expired token
 */

const AppError = require('../utils/AppError');

// ── Error Transformers ─────────────────────────────────────────────────────

// Invalid MongoDB ObjectId (e.g., /api/v1/restaurants/bad-id)
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: "${err.value}". Please provide a valid ID.`;
  return new AppError(message, 400);
};

// Mongoose unique field violation (e.g., duplicate email)
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `The ${field} "${value}" is already taken. Please use a different value.`;
  return new AppError(message, 409);
};

// Mongoose schema validation errors (multiple errors possible)
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => e.message);
  const message = `Validation failed: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// JWT signature invalid
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401);

// JWT expired
const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401);

// ── Response Senders ───────────────────────────────────────────────────────

// Development: full error details + stack trace
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// Production: only expose operational errors (user-facing), hide programmer bugs
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    // Operational error: safe to expose to client
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming error: log it, send generic message
    console.error('💥 PROGRAMMING ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
};

// ── Global Error Handler ───────────────────────────────────────────────────
// 4-parameter signature is required for Express to recognize as error handler.
// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = err;

    // Transform known DB/JWT errors into operational AppErrors
    if (err.name === 'CastError')        error = handleCastError(err);
    if (err.code === 11000)             error = handleDuplicateKeyError(err);
    if (err.name === 'ValidationError') error = handleValidationError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // If it's an AppError (isOperational), preserve its status code and message
    if (err.isOperational && !error.isOperational) {
      error.isOperational = true;
      error.statusCode = err.statusCode;
      error.message = err.message;
    }

    sendErrorProd(error, res);
  }
};

module.exports = globalErrorHandler;
