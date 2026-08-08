/**
 * @file server.js
 * @description Application entry point.
 *
 * This file has exactly three responsibilities:
 *  1. Load environment variables (dotenv) — must happen BEFORE any other import
 *     that reads from process.env
 *  2. Connect to the database
 *  3. Start the HTTP server
 *
 * It does NOT configure Express — that is app.js's job.
 * This separation allows app.js to be imported in tests without starting a server.
 *
 * Process-level error handling:
 *  - uncaughtException  → Synchronous throws that escaped all try/catch blocks
 *  - unhandledRejection → Async Promise rejections that were never .catch()'d
 *
 * Both handlers log the error, then exit.
 * A process manager (PM2, Docker restart policy) will restart the process.
 */

// ── IMPORTANT: dotenv must be the very first require ─────────────────────────
// It populates process.env from .env BEFORE any other module reads those values.
// If you move this below another require, that module may read `undefined` values.
require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');

// ── Configuration ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Process-level: Uncaught Synchronous Exceptions ───────────────────────────
// Fires when a synchronous error is thrown and never caught.
// Example: JSON.parse(undefined) at the top level of a required module.
// Strategy: Log → Exit (let process manager restart)
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  process.exit(1);
});

// ── Bootstrap Function ────────────────────────────────────────────────────────
// Wrapping everything in an async function lets us use `await` for DB connection
// and ensures the server only starts if the DB connection succeeds.
const startServer = async () => {
  try {
    // Step 1: Connect to MongoDB Atlas before accepting any requests.
    // If this throws, the catch block below will handle it.
    await connectDB();

    // Step 2: Create the HTTP server from the Express app.
    // Using http.createServer() (instead of app.listen()) gives us a reference
    // to the raw server object — required for graceful shutdown and WebSockets later.
    const server = http.createServer(app);

    // Step 3: Start listening for incoming connections.
    server.listen(PORT, () => {
      console.log('─────────────────────────────────────────');
      console.log(`🚀 Server running in ${NODE_ENV} mode`);
      console.log(`🌐 Listening on http://localhost:${PORT}`);
      console.log(`🔍 Health: http://localhost:${PORT}/api/v1/health`);
      console.log('─────────────────────────────────────────');
    });

    // ── Process-level: Unhandled Promise Rejections ─────────────────────────
    // Fires when a Promise is rejected and no .catch() handler is attached.
    // Example: An awaited DB query fails inside a route with no try/catch.
    // Strategy: Log → Graceful shutdown → Exit
    process.on('unhandledRejection', (error) => {
      console.error('💥 UNHANDLED REJECTION! Shutting down...');
      console.error(error.name, error.message);

      // Close the server gracefully: stop accepting new connections,
      // wait for in-flight requests to finish, then exit.
      server.close(() => {
        process.exit(1);
      });
    });

    // ── Graceful Shutdown: SIGTERM ───────────────────────────────────────────
    // SIGTERM is sent by process managers (PM2, Kubernetes, Docker) when they
    // want the process to stop cleanly (e.g., on deploy or scale-down).
    // We stop accepting new connections and wait for current ones to finish.
    process.on('SIGTERM', () => {
      console.log('📴 SIGTERM received. Closing server gracefully...');
      server.close(() => {
        console.log('✅ Server closed. Process exiting.');
        process.exit(0);
      });
    });

  } catch (error) {
    // If connectDB() or server.listen() itself throws synchronously,
    // we catch it here and exit with a failure code.
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Kick off the bootstrap
startServer();
