/**
 * @file src/seeds/runSeedDirect.js
 * @description Direct seeding runner into MongoDB Atlas with Google DNS resolver.
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user.model');
const Restaurant = require('../models/restaurant.model');
const MenuItem = require('../models/menuItem.model');
const { RESTAURANTS_DATA } = require('./seedData');

async function runDirectSeed() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas!');

    // Find any owner user or fallback user
    let owner = await User.findOne({ role: 'owner' });
    if (!owner) {
      owner = await User.findOne();
    }
    if (!owner) {
      console.error('❌ No user found in DB. Please sign up an owner or customer first.');
      process.exit(1);
    }
    console.log(`Using Owner: ${owner.name} (${owner.email})`);

    let createdCount = 0;
    let menuCount = 0;

    for (const rData of RESTAURANTS_DATA) {
      let rest = await Restaurant.findOne({ name: rData.name });
      if (!rest) {
        rest = await Restaurant.create({
          name: rData.name,
          description: rData.description,
          cuisine: rData.cuisine,
          phone: rData.phone,
          deliveryTime: rData.deliveryTime,
          deliveryFee: rData.deliveryFee,
          minimumOrder: rData.minimumOrder,
          rating: rData.rating,
          totalRatings: rData.totalRatings,
          image: rData.image,
          address: rData.address,
          location: rData.location,
          owner: owner._id,
          isActive: true,
        });
        createdCount++;
        console.log(`➕ Created Restaurant: ${rest.name}`);
      } else {
        // Update location and image if needed
        rest.location = rData.location;
        rest.image = rData.image;
        rest.isActive = true;
        await rest.save();
        console.log(`🔄 Updated Restaurant: ${rest.name}`);
      }

      // Seed menu items
      for (const item of rData.menu) {
        const existingItem = await MenuItem.findOne({ name: item.name, restaurant: rest._id });
        if (!existingItem) {
          await MenuItem.create({
            ...item,
            restaurant: rest._id,
            isAvailable: true,
          });
          menuCount++;
          console.log(`   🍽️ Added Item: ${item.name} (₹${item.price})`);
        }
      }
    }

    const totalRests = await Restaurant.countDocuments({ isActive: true });
    const totalItems = await MenuItem.countDocuments();

    console.log('\n========================================');
    console.log(`🎉 SEEDING COMPLETE!`);
    console.log(`🏢 Total Active Restaurants: ${totalRests}`);
    console.log(`🍕 Total Menu Items in DB: ${totalItems}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

runDirectSeed();
