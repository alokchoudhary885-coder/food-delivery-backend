/**
 * @file src/utils/response.js
 * @description Standardizes all API responses across the application.
 * Every endpoint sends a consistent JSON envelope so the React
 * frontend always knows the shape of the response.
 *
 * Two helpers are exported:
 *   - sendSuccess          → for single-resource or non-paginated responses.
 *   - sendPaginatedSuccess → for list endpoints; enforces the pagination envelope.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {object|Array} data
 * @param {object} [meta] - Pagination or extra metadata
 */
const sendSuccess = (res, statusCode, message, data = null, meta = null) => {
  const response = {
    status: 'success',
    message,
    ...(data !== null && { data }),
    ...(meta !== null && { meta }),
  };
  return res.status(statusCode).json(response);
};

/**
 * Send a fail/error response (rarely needed directly — use AppError + global handler).
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 */
const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    message,
  });
};

/**
 * Send a standardised paginated list response.
 *
 * Produces the following envelope:
 * {
 *   "success": true,
 *   "results": <number of items in this page>,
 *   "pagination": { "page", "limit", "totalPages", "totalResults" },
 *   "data": { <dataKey>: [...] }
 * }
 *
 * @param {import('express').Response} res
 * @param {string} dataKey          - The key name for the array in `data` (e.g. 'restaurants').
 * @param {Array}  items            - The array of documents for the current page.
 * @param {{ page: number, limit: number, totalPages: number, totalResults: number }} pagination
 */
const sendPaginatedSuccess = (res, dataKey, items, pagination) => {
  return res.status(200).json({
    success: true,
    results: items.length,
    pagination: {
      page:         pagination.page,
      limit:        pagination.limit,
      totalPages:   pagination.totalPages,
      totalResults: pagination.totalResults,
    },
    data: { [dataKey]: items },
  });
};

module.exports = { sendSuccess, sendError, sendPaginatedSuccess };
