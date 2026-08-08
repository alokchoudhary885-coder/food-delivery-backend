/**
 * @file src/utils/AppError.js
 * @description Custom error class that extends the native Error.
 * Adds statusCode and isOperational flag for the global error handler.
 *
 * isOperational = true  → Expected errors (wrong input, 404, auth fail)
 * isOperational = false → Programming bugs (should crash the process)
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message); // Sets this.message
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // Captures the stack trace, excluding the constructor call itself
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
