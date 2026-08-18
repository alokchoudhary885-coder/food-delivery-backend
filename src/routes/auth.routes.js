/**
 * @file src/routes/auth.routes.js
 * @description Authentication routes.
 *
 * POST   /api/v1/auth/register         → Register a new user
 * POST   /api/v1/auth/login            → Login and receive JWT
 * GET    /api/v1/auth/me               → Get own profile (protected)
 * PATCH  /api/v1/auth/update-password  → Change password (protected)
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect, validate } = require('../middlewares/auth.middleware');
const { registerSchema, loginSchema, updatePasswordSchema } = require('../validators/auth.validator');

const router = express.Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login',    validate(loginSchema),    authController.login);
router.post('/send-otp',   authController.sendOTP);
router.post('/send-email-otp', authController.sendEmailOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);
router.post('/google',     authController.googleLogin);
router.post('/firebase-login', authController.firebaseLogin);


// Protected routes (JWT required)
router.get('/me',                protect, authController.getMe);
router.patch('/update-password', protect, validate(updatePasswordSchema), authController.updatePassword);

module.exports = router;
