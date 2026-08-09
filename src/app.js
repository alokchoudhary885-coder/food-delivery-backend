/**
 * @file src/app.js
 * @description Express application factory.
 *
 * This file configures the Express app — middleware stack, routes, and error handling.
 * It does NOT start the HTTP server. That is server.js's job.
 *
 * Middleware execution order matters in Express. The order here is intentional:
 *
 *  1. Security  (Helmet)         → Set secure HTTP headers immediately
 *  2. CORS                       → Handle preflight OPTIONS before any route logic
 *  3. Logging   (Morgan)         → Log every request (including those rejected by CORS)
 *  4. Body parsers               → Parse req.body before controllers need it
 *  5. Routes                     → Business logic
 *  6. 404 handler                → Catch requests that matched no route
 *  7. Global error handler       → Centralized error response (MUST be last)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes       = require('./routes/auth.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const orderRoutes      = require('./routes/order.routes');
const menuItemRoutes   = require('./routes/menuItem.routes');
const paymentRoutes    = require('./routes/payment.routes');
const uploadRoutes     = require('./routes/upload.routes');

// ── Error handler ─────────────────────────────────────────────────────────────
const globalErrorHandler = require('./middlewares/error.middleware');
const AppError = require('./utils/AppError');

// ── App Instance ──────────────────────────────────────────────────────────────

const app = express();

// ── Trust Proxy ───────────────────────────────────────────────────────────────
// Required when running behind a reverse proxy (Nginx, AWS ALB, Heroku).
// Without this, req.ip will be the proxy IP, not the client IP.
// This also makes express-rate-limit work correctly per-user.
app.set('trust proxy', 1);

// ── 1. Security: Helmet ───────────────────────────────────────────────────────
// Sets ~15 security-related HTTP headers automatically.
// Protects against XSS, clickjacking, MIME sniffing, and more.
// Always apply FIRST — before any other middleware or routes.
app.use(helmet());

// ── 2. CORS ───────────────────────────────────────────────────────────────────
// Cross-Origin Resource Sharing — allows your React frontend to call this API.
// Must be configured BEFORE routes so OPTIONS preflight requests are handled.
const corsOptions = {
  // Allow requests only from the CLIENT_URL defined in .env
  // In production, this should be your deployed React app's domain.
  origin: process.env.CLIENT_URL || 'http://localhost:3000',

  // Allow these HTTP methods from the frontend
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Allow these headers in requests from the frontend
  allowedHeaders: ['Content-Type', 'Authorization'],

  // Allow cookies / credentials to be sent cross-origin (needed for refresh tokens later)
  credentials: true,
};

app.use(cors(corsOptions));

// ── 3. HTTP Request Logging: Morgan ───────────────────────────────────────────
// 'dev'      → Colorized output, concise. Best for local development.
// 'combined' → Apache-style logs. Best for production (works with Datadog, CloudWatch, etc.)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── 4. Body Parsers ───────────────────────────────────────────────────────────
// Parse incoming JSON payloads (application/json)
// Limit prevents large payload denial-of-service attacks.
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded form data (application/x-www-form-urlencoded)
// The `extended: true` option allows nested objects (uses qs library).
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── 5. API Routes ─────────────────────────────────────────────────────────────
// All routes are versioned under /api/v1/
// This allows future non-breaking API upgrades by adding /api/v2/ alongside.

// Health check — no auth required. Used by load balancers, uptime monitors, Docker.
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Food Delivery API is up and running 🍔',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Mount feature routers
app.use('/api/v1/auth',        authRoutes);
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/v1/menu',        menuItemRoutes);
app.use('/api/v1/orders',      orderRoutes);
app.use('/api/v1/payments',    paymentRoutes);
app.use('/api/v1/upload',      uploadRoutes);      // Cloudinary image upload

// ── 6. 404 Handler ────────────────────────────────────────────────────────────
// Catches any request that didn't match a registered route above.
// Must come AFTER all route registrations.
app.use((req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// ── 7. Global Error Handler ───────────────────────────────────────────────────
// Imported from error.middleware.js — handles Mongoose + JWT errors too.
// MUST be the last middleware registered.
app.use(globalErrorHandler);

module.exports = app;
