/**
 * @file src/validators/order.validator.js
 * @description Joi validation schemas for order routes.
 */

const Joi = require('joi');

const orderItemSchema = Joi.object({
  menuItem: Joi.string().hex().length(24).required().messages({
    'any.required': 'Menu item ID is required',
    'string.length': 'Invalid menu item ID',
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    'any.required': 'Quantity is required',
    'number.min': 'Quantity must be at least 1',
  }),
});

const addressSchema = Joi.object({
  street:  Joi.string().required(),
  city:    Joi.string().required(),
  state:   Joi.string().required(),
  pincode: Joi.string().required(),
});

const createOrderSchema = Joi.object({
  restaurant:      Joi.string().hex().length(24).required().messages({
    'any.required': 'Restaurant ID is required',
  }),
  items:           Joi.array().items(orderItemSchema).min(1).required().messages({
    'array.min': 'Order must have at least one item',
    'any.required': 'Items are required',
  }),
  deliveryAddress: addressSchema.required(),
  paymentMethod:   Joi.string().valid('cash_on_delivery', 'online').default('cash_on_delivery'),
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('confirmed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'rejected')
    .required(),
  cancellationReason: Joi.when('status', {
    is: Joi.string().valid('cancelled', 'rejected'),
    then: Joi.string().optional().allow(''),
    otherwise: Joi.optional().allow(''),
  }),
});

module.exports = { createOrderSchema, updateOrderStatusSchema };
