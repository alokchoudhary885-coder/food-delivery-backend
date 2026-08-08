/**
 * @file src/validators/restaurant.validator.js
 * @description Joi validation schemas for restaurant routes.
 */

const Joi = require('joi');

const VALID_CUISINES = [
  'Indian', 'Chinese', 'Italian', 'Mexican', 'American',
  'Japanese', 'Thai', 'Mediterranean', 'FastFood', 'Bakery',
  'Beverages', 'Desserts', 'Other',
];

const addressSchema = Joi.object({
  street:  Joi.string().required().messages({ 'any.required': 'Street is required' }),
  city:    Joi.string().required().messages({ 'any.required': 'City is required' }),
  state:   Joi.string().required().messages({ 'any.required': 'State is required' }),
  pincode: Joi.string().required().messages({ 'any.required': 'Pincode is required' }),
});

const createRestaurantSchema = Joi.object({
  name:        Joi.string().max(100).required(),
  description: Joi.string().max(500).optional(),
  cuisine:     Joi.array().items(Joi.string().valid(...VALID_CUISINES)).min(1).required(),
  address:     addressSchema.required(),
  phone:       Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Phone must be a valid 10-digit number',
  }),
  deliveryTime:  Joi.number().min(5).optional(),
  minimumOrder:  Joi.number().min(0).optional(),
  deliveryFee:   Joi.number().min(0).optional(),
});

const updateRestaurantSchema = Joi.object({
  name:          Joi.string().max(100).optional(),
  description:   Joi.string().max(500).optional(),
  cuisine:       Joi.array().items(Joi.string().valid(...VALID_CUISINES)).min(1).optional(),
  address:       addressSchema.optional(),
  phone:         Joi.string().pattern(/^[0-9]{10}$/).optional(),
  deliveryTime:  Joi.number().min(5).optional(),
  minimumOrder:  Joi.number().min(0).optional(),
  deliveryFee:   Joi.number().min(0).optional(),
  isActive:      Joi.boolean().optional(),
});

module.exports = { createRestaurantSchema, updateRestaurantSchema };
