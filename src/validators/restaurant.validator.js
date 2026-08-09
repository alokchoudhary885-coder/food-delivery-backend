/**
 * @file src/validators/restaurant.validator.js
 * @description Joi validation schemas for restaurant routes.
 */

const Joi = require('joi');

const addressSchema = Joi.object({
  street:  Joi.string().optional(),
  city:    Joi.string().required().messages({ 'any.required': 'City is required' }),
  state:   Joi.string().optional(),
  pincode: Joi.string().optional(),
});

const createRestaurantSchema = Joi.object({
  name:          Joi.string().max(100).required(),
  description:   Joi.string().max(500).optional(),
  cuisine:       Joi.array().items(Joi.string()).optional().default([]),
  address:       addressSchema.required(),
  phone:         Joi.string().pattern(/^[0-9]{10}$/).optional().messages({
    'string.pattern.base': 'Phone must be a valid 10-digit number',
  }),
  image:         Joi.string().uri().optional(),
  deliveryTime:  Joi.number().min(5).optional(),
  minimumOrder:  Joi.number().min(0).optional(),
  deliveryFee:   Joi.number().min(0).optional(),
});

const updateRestaurantSchema = Joi.object({
  name:          Joi.string().max(100).optional(),
  description:   Joi.string().max(500).optional(),
  cuisine:       Joi.array().items(Joi.string()).optional(),
  address:       addressSchema.optional(),
  phone:         Joi.string().pattern(/^[0-9]{10}$/).optional(),
  image:         Joi.string().uri().optional(),
  deliveryTime:  Joi.number().min(5).optional(),
  minimumOrder:  Joi.number().min(0).optional(),
  deliveryFee:   Joi.number().min(0).optional(),
  isActive:      Joi.boolean().optional(),
});

module.exports = { createRestaurantSchema, updateRestaurantSchema };
