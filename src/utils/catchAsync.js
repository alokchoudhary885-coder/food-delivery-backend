/**
 * @file src/utils/catchAsync.js
 * @description Higher-order function that wraps async route handlers.
 * Eliminates the need for try/catch in every controller.
 * Any rejected promise is forwarded to Express's global error handler via next().
 */

const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
