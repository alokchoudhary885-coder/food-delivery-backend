/**
 * @file src/controllers/auth.controller.js
 * @description Auth route handlers — thin layer that delegates to auth.service.js.
 * Each controller function: calls service → formats response → sends JSON.
 */

const { StatusCodes } = require('http-status-codes');
const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

/**
 * POST /api/v1/auth/register
 * @access Public
 */
const register = catchAsync(async (req, res) => {
  const { user, token } = await authService.registerUser(req.body);

  sendSuccess(res, StatusCodes.CREATED, 'Account created successfully.', { user, token });
});

/**
 * POST /api/v1/auth/login
 * @access Public
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await authService.loginUser(email, password);

  sendSuccess(res, StatusCodes.OK, 'Logged in successfully.', { user, token });
});

/**
 * GET /api/v1/auth/me
 * @access Private
 */
const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  sendSuccess(res, StatusCodes.OK, 'User profile fetched successfully.', { user });
});

/**
 * PATCH /api/v1/auth/update-password
 * @access Private
 */
const updatePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { user, token } = await authService.updatePassword(
    req.user._id,
    currentPassword,
    newPassword
  );

  sendSuccess(res, StatusCodes.OK, 'Password updated successfully.', { user, token });
});

const sendOTP = catchAsync(async (req, res) => {
  const { phone } = req.body;
  const result = await authService.sendOTP(phone);
  sendSuccess(res, StatusCodes.OK, 'OTP sent successfully', result);
});

const verifyOTP = catchAsync(async (req, res) => {
  const { phone, otp } = req.body;
  const { user, token } = await authService.verifyOTP(phone, otp);
  sendSuccess(res, StatusCodes.OK, 'OTP verified successfully', { user, token });
});

const googleLogin = catchAsync(async (req, res) => {
  const { user, token } = await authService.googleLogin(req.body);
  sendSuccess(res, StatusCodes.OK, 'Logged in with Google successfully.', { user, token });
});

module.exports = { register, login, getMe, updatePassword, sendOTP, verifyOTP, googleLogin };
