/**
 * @file src/config/db.js
 * @description MongoDB Atlas connection using Mongoose.
 */

const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google & Cloudflare DNS
dns.setServers(['8.8.8.8', '1.1.1.1']);

/**
 * Connects to MongoDB Atlas.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Connection events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconnected successfully.');
});

mongoose.set('strictQuery', true);

module.exports = connectDB;