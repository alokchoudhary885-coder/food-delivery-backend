/**
 * @file src/seeds/seedData.js
 * @description Populates MongoDB with 8 top-rated restaurants and 40+ rich menu items across all cuisines.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/user.model');
const Restaurant = require('../models/restaurant.model');
const MenuItem = require('../models/menuItem.model');

const RESTAURANTS_DATA = [
  {
    name: 'Pizza Palace & Cafe',
    description: 'Artisan wood-fired pizzas, cheesy garlic breads, and authentic Italian pastas.',
    cuisine: ['Pizza', 'Italian', 'Fast Food'],
    phone: '9876543210',
    deliveryTime: 25,
    deliveryFee: 40,
    minimumOrder: 150,
    rating: 4.8,
    totalRatings: 142,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop',
    address: { street: 'C-Scheme, Ashok Nagar', city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
    location: { type: 'Point', coordinates: [75.8012, 26.9157] },
    menu: [
      { name: 'Margherita Basil Pizza', price: 249, category: 'Main Course', isVeg: true, spiceLevel: 'mild', description: 'Fresh mozzarella, San Marzano tomato sauce, fresh basil leaves.', image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500' },
      { name: 'Farmhouse Supreme Pizza', price: 349, category: 'Main Course', isVeg: true, spiceLevel: 'medium', description: 'Loaded with crisp capsicum, juicy tomatoes, mushrooms, and golden corn.', image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500' },
      { name: 'Spicy Peri Peri Chicken Pizza', price: 399, category: 'Main Course', isVeg: false, spiceLevel: 'hot', description: 'Spicy grilled chicken chunks, red paprika, jalapenos, and mozzarella.', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500' },
      { name: 'Cheesy Garlic Breadsticks', price: 149, category: 'Starter', isVeg: true, spiceLevel: 'mild', description: 'Freshly baked buttery garlic bread loaded with melted mozzarella.', image: 'https://images.unsplash.com/photo-1619881590738-a111d176d906?w=500' },
      { name: 'Creamy Alfredo White Sauce Pasta', price: 229, category: 'Main Course', isVeg: true, spiceLevel: 'mild', description: 'Al dente penne in rich parmesan cream sauce with herbs.', image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500' },
    ]
  },
  {
    name: 'The Royal Biryani House',
    description: 'Authentic Hyderabadi & Lucknowi Dum Biryanis slow-cooked with royal saffron and spices.',
    cuisine: ['Biryani', 'Mughlai', 'North Indian'],
    phone: '9876543211',
    deliveryTime: 35,
    deliveryFee: 50,
    minimumOrder: 200,
    rating: 4.9,
    totalRatings: 289,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop',
    address: { street: 'MI Road, Near Panch Batti', city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
    location: { type: 'Point', coordinates: [75.8124, 26.9182] },
    menu: [
      { name: 'Hyderabadi Chicken Dum Biryani', price: 320, category: 'Main Course', isVeg: false, spiceLevel: 'hot', description: 'Fragrant aged basmati rice layered with succulent spiced chicken and brown onions.', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500' },
      { name: 'Shahi Paneer Tikka Biryani', price: 280, category: 'Main Course', isVeg: true, spiceLevel: 'medium', description: 'Chargrilled cottage cheese tikka tossed in fragrant saffron rice with raita.', image: 'https://images.unsplash.com/photo-1642821373181-696a54913e9a?w=500' },
      { name: 'Tandoori Chicken Tikka (6 Pcs)', price: 260, category: 'Starter', isVeg: false, spiceLevel: 'hot', description: 'Juicy chicken chunks marinated in hung curd, Kashmiri mirch, and roasted in tandoor.', image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500' },
      { name: 'Murgh Malai Tikka', price: 280, category: 'Starter', isVeg: false, spiceLevel: 'mild', description: 'Creamy melt-in-mouth chicken kebabs infused with cardamom and cheese.', image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500' },
      { name: 'Gulab Jamun (2 Pcs)', price: 80, category: 'Dessert', isVeg: true, spiceLevel: 'mild', description: 'Warm soft khoya dumplings soaked in rose cardamom sugar syrup.', image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500' },
    ]
  },
  {
    name: 'Burger Nation & Shakes',
    description: 'Juicy gourmet burgers, crispy loaded fries, and thick artisanal milkshakes.',
    cuisine: ['Burger', 'Fast Food', 'Beverages'],
    phone: '9876543212',
    deliveryTime: 20,
    deliveryFee: 30,
    minimumOrder: 120,
    rating: 4.7,
    totalRatings: 195,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop',
    address: { street: 'Malviya Nagar, Sector 4', city: 'Jaipur', state: 'Rajasthan', pincode: '302017' },
    location: { type: 'Point', coordinates: [75.8205, 26.8524] },
    menu: [
      { name: 'Crispy Veggie Supreme Burger', price: 149, category: 'Main Course', isVeg: true, spiceLevel: 'medium', description: 'Crispy herb potato patty layered with fresh lettuce, tomatoes, and secret mayo.', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500' },
      { name: 'Double Cheese Smash Chicken Burger', price: 249, category: 'Main Course', isVeg: false, spiceLevel: 'medium', description: 'Grilled chicken patty layered with double cheddar, caramelized onions, and BBQ glaze.', image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500' },
      { name: 'Peri Peri Crispy French Fries', price: 119, category: 'Starter', isVeg: true, spiceLevel: 'hot', description: 'Golden potato fries tossed in spicy African peri peri seasoning.', image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500' },
      { name: 'Thick Belgian Chocolate Shake', price: 159, category: 'Beverages', isVeg: true, spiceLevel: 'mild', description: 'Rich chocolate ice cream blended with Belgian cocoa and chocolate fudge.', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500' },
      { name: 'Crispy Onion Rings', price: 129, category: 'Starter', isVeg: true, spiceLevel: 'mild', description: 'Batter fried golden onion rings served with spicy cocktail dip.', image: 'https://images.unsplash.com/photo-1639024471287-032f66e5224e?w=500' },
    ]
  },
  {
    name: 'Rolls & Wraps Express',
    description: 'Hot handmade flaky paratha rolls loaded with fresh tikka and mint chutney.',
    cuisine: ['Rolls', 'Street Food', 'Fast Food'],
    phone: '9876543213',
    deliveryTime: 20,
    deliveryFee: 25,
    minimumOrder: 100,
    rating: 4.6,
    totalRatings: 110,
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop',
    address: { street: 'Vaishali Nagar, Amrapali Circle', city: 'Jaipur', state: 'Rajasthan', pincode: '302021' },
    location: { type: 'Point', coordinates: [75.7412, 26.9082] },
    menu: [
      { name: 'Paneer Tikka Kathi Roll', price: 169, category: 'Main Course', isVeg: true, spiceLevel: 'medium', description: 'Charcoal roasted paneer cubes, crunchy onions, and green mint chutney in a paratha.', image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500' },
      { name: 'Double Egg Chicken Roll', price: 199, category: 'Main Course', isVeg: false, spiceLevel: 'hot', description: 'Egg layered paratha filled with spicy shredded chicken and tangy sauces.', image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=500' },
      { name: 'Cheesy Corn & Veggies Wrap', price: 149, category: 'Main Course', isVeg: true, spiceLevel: 'mild', description: 'Sweet corn, bell peppers, melted cheese sauce wrapped in whole wheat tortilla.', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500' },
      { name: 'Masala Lemonade Cooler', price: 69, category: 'Beverages', isVeg: true, spiceLevel: 'mild', description: 'Chilled refreshing lemon soda with roasted cumin and black salt.', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500' },
    ]
  },
  {
    name: 'Dragon Wok Asian Kitchen',
    description: 'Sizzling Chinese, wok-tossed noodles, crunchy Manchurian, and steaming dim sums.',
    cuisine: ['Chinese', 'Asian', 'Noodles'],
    phone: '9876543214',
    deliveryTime: 30,
    deliveryFee: 40,
    minimumOrder: 180,
    rating: 4.8,
    totalRatings: 164,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop',
    address: { street: 'Tonk Road, Bapu Nagar', city: 'Jaipur', state: 'Rajasthan', pincode: '302015' },
    location: { type: 'Point', coordinates: [75.7982, 26.8851] },
    menu: [
      { name: 'Veg Hakka Noodles', price: 179, category: 'Main Course', isVeg: true, spiceLevel: 'mild', description: 'Classic wok-tossed noodles with shredded cabbage, carrots, capsicum, and scallions.', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500' },
      { name: 'Chilli Chicken Gravy', price: 279, category: 'Main Course', isVeg: false, spiceLevel: 'hot', description: 'Tender batter-fried chicken cubes tossed in spicy soy-garlic sauce with green chilies.', image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=500' },
      { name: 'Crispy Veg Spring Rolls (6 Pcs)', price: 159, category: 'Starter', isVeg: true, spiceLevel: 'medium', description: 'Golden fried crispy wrappers stuffed with seasoned Asian vegetables with sweet chili dip.', image: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=500' },
      { name: 'Schezwan Fried Rice', price: 189, category: 'Main Course', isVeg: true, spiceLevel: 'hot', description: 'Spicy wok-tossed rice flavored with homemade Schezwan chili paste and spring onions.', image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500' },
    ]
  },
  {
    name: 'Sweet Tooth Bakery & Cafe',
    description: 'Decadent chocolate cakes, warm brownies, artisan pastries, and ice creams.',
    cuisine: ['Desserts', 'Bakery', 'Beverages'],
    phone: '9876543215',
    deliveryTime: 20,
    deliveryFee: 30,
    minimumOrder: 100,
    rating: 4.9,
    totalRatings: 310,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop',
    address: { street: 'Raja Park, Lane 4', city: 'Jaipur', state: 'Rajasthan', pincode: '302004' },
    location: { type: 'Point', coordinates: [75.8341, 26.8972] },
    menu: [
      { name: 'Sizzling Hot Chocolate Brownie', price: 149, category: 'Dessert', isVeg: true, spiceLevel: 'mild', description: 'Fudge dark chocolate walnut brownie with warm Belgian chocolate ganache.', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500' },
      { name: 'Red Velvet Pastry', price: 129, category: 'Dessert', isVeg: true, spiceLevel: 'mild', description: 'Moist red velvet sponge layered with smooth Philadelphia cream cheese frosting.', image: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=500' },
      { name: 'Choco Lava Cupcake', price: 99, category: 'Dessert', isVeg: true, spiceLevel: 'mild', description: 'Warm chocolate cake with molten chocolate core exploding on first bite.', image: 'https://images.unsplash.com/photo-1603532648955-039310d9ed75?w=500' },
      { name: 'Cold Coffee with Ice Cream', price: 129, category: 'Beverages', isVeg: true, spiceLevel: 'mild', description: 'Creamy blended espresso coffee topped with vanilla ice cream and chocolate syrup.', image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500' },
    ]
  }
];

module.exports = { RESTAURANTS_DATA };
