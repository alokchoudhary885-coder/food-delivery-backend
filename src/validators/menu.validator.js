/**
 * @file src/validators/menu.validator.js
 * @description Joi validation schemas for menu item routes.
 */

const Joi = require('joi');

const VALID_CATEGORIES = [
  'Starter', 'Main Course', 'Dessert', 'Beverage',
  'Bread', 'Rice', 'Salad', 'Combo', 'Other',
];

const createMenuItemSchema = Joi.object({
  name:        Joi.string().max(100).required(),
  description: Joi.string().max(300).optional(),
  price:       Joi.number().min(0).required().messages({ 'any.required': 'Price is required' }),
  category:    Joi.string().valid(...VALID_CATEGORIES).required().messages({
    'any.only': `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
  }),
  isVeg:       Joi.boolean().optional(),
  isAvailable: Joi.boolean().optional(),
  spiceLevel:  Joi.string().valid('mild', 'medium', 'hot', 'extra-hot').optional(),
});

const updateMenuItemSchema = Joi.object({
  name:        Joi.string().max(100).optional(),
  description: Joi.string().max(300).optional(),
  price:       Joi.number().min(0).optional(),
  category:    Joi.string().valid(...VALID_CATEGORIES).optional(),
  isVeg:       Joi.boolean().optional(),
  isAvailable: Joi.boolean().optional(),
  spiceLevel:  Joi.string().valid('mild', 'medium', 'hot', 'extra-hot').optional(),
});

module.exports = { createMenuItemSchema, updateMenuItemSchema };
