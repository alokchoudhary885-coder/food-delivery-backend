/**
 * @file src/routes/upload.routes.js
 * @description Image upload endpoints for restaurants and menu items.
 */

const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { uploadRestaurantImage, uploadMenuImage } = require('../config/cloudinary');
const catchAsync = require('../utils/catchAsync');

/**
 * POST /api/v1/upload/restaurant
 * Upload a restaurant banner image.
 * @access Private (owner)
 * @body  FormData with field "image"
 */
router.post(
  '/restaurant',
  protect,
  (req, res, next) => {
    uploadRestaurantImage(req, res, (err) => {
      if (err) {
        return res.status(400).json({ status: 'fail', message: err.message });
      }
      next();
    });
  },
  catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Image file required.' });
    }
    res.status(200).json({
      status:  'success',
      message: 'Restaurant image uploaded successfully.',
      data: {
        url:      req.file.path,
        publicId: req.file.filename,
      },
    });
  })
);

/**
 * POST /api/v1/upload/menu
 * Upload a menu item image.
 * @access Private (owner)
 * @body  FormData with field "image"
 */
router.post(
  '/menu',
  protect,
  (req, res, next) => {
    uploadMenuImage(req, res, (err) => {
      if (err) {
        return res.status(400).json({ status: 'fail', message: err.message });
      }
      next();
    });
  },
  catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Image file required.' });
    }
    res.status(200).json({
      status:  'success',
      message: 'Menu image uploaded successfully.',
      data: {
        url:      req.file.path,
        publicId: req.file.filename,
      },
    });
  })
);

module.exports = router;
