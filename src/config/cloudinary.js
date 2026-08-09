/**
 * @file src/config/cloudinary.js
 * @description Cloudinary configuration and upload middleware.
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ── Configure Cloudinary ─────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Restaurant Image Storage ─────────────────────────────────────
const restaurantStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'foodrush/restaurants',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 400, crop: 'fill', quality: 'auto' }],
  },
});

// ── Menu Item Image Storage ──────────────────────────────────────
const menuStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'foodrush/menu',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 300, crop: 'fill', quality: 'auto' }],
  },
});

// ── Multer Middlewares ───────────────────────────────────────────
const uploadRestaurantImage = multer({
  storage: restaurantStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
}).single('image');

const uploadMenuImage = multer({
  storage: menuStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max
}).single('image');

// ── Delete image from Cloudinary ─────────────────────────────────
const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

module.exports = {
  cloudinary,
  uploadRestaurantImage,
  uploadMenuImage,
  deleteImage,
};
