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

const locationSchema = Joi.object({
  type: Joi.string().valid('Point').default('Point'),
  coordinates: Joi.array().items(Joi.number()).length(2).required(),
});

const createRestaurantSchema = Joi.object({
  name:          Joi.string().max(100).required(),
  description:   Joi.string().max(500).optional().allow(''),
  cuisine:       Joi.array().items(Joi.string()).optional().default([]),
  cuisineType:   Joi.array().items(Joi.string()).optional(),
  address:       addressSchema.required(),
  phone:         Joi.string().pattern(/^[0-9]{10}$/).optional().allow('').messages({
    'string.pattern.base': 'Phone must be a valid 10-digit number',
  }),
  image:         Joi.string().uri().optional().allow(''),
  deliveryTime:  Joi.number().min(5).optional(),
  minimumOrder:  Joi.number().min(0).optional(),
  deliveryFee:   Joi.number().min(0).optional(),
  location:      locationSchema.optional(),
  coordinates:   Joi.array().items(Joi.number()).length(2).optional(),
});

const updateRestaurantSchema = Joi.object({
  name:          Joi.string().max(100).optional(),
  description:   Joi.string().max(500).optional().allow(''),
  cuisine:       Joi.array().items(Joi.string()).optional(),
  cuisineType:   Joi.array().items(Joi.string()).optional(),
  address:       addressSchema.optional(),
  phone:         Joi.string().pattern(/^[0-9]{10}$/).optional().allow(''),
  image:         Joi.string().uri().optional().allow(''),
  deliveryTime:  Joi.number().min(5).optional(),
  minimumOrder:  Joi.number().min(0).optional(),
  deliveryFee:   Joi.number().min(0).optional(),
  isActive:      Joi.boolean().optional(),
  location:      locationSchema.optional(),
  coordinates:   Joi.array().items(Joi.number()).length(2).optional(),
});

module.exports = { createRestaurantSchema, updateRestaurantSchema };
