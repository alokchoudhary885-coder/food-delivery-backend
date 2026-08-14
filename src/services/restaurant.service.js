/**
 * @file src/services/restaurant.service.js
 * @description Restaurant business logic with GeoJSON 2dsphere and Nearby Discovery.
 */

const Restaurant = require('../models/restaurant.model');
const AppError = require('../utils/AppError');

/**
 * Helper to calculate Haversine distance in meters between two lat/lng pairs.
 */
const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Create a new restaurant (owner only).
 * @param {object} data
 * @param {string} ownerId
 */
const createRestaurant = async (data, ownerId) => {
  const restaurant = await Restaurant.create({ ...data, owner: ownerId });
  return restaurant;
};

/**
 * Get all active restaurants with optional city filter.
 * @param {object} query - { city, cuisine, page, limit }
 */
const getAllRestaurants = async (query) => {
  const { city, cuisine, name, minRating, page = 1, limit = 9 } = query;

  const filter = { isActive: true };

  // Name search (case-insensitive)
  if (name)      { filter.name = new RegExp(name, 'i'); }

  // City filter (case-insensitive)
  if (city)      { filter['address.city'] = new RegExp(city, 'i'); }

  // Cuisine type filter
  if (cuisine)   { filter.cuisine = { $in: [new RegExp(cuisine, 'i')] }; }

  // Minimum rating filter
  if (minRating) { filter.rating = { $gte: Number(minRating) }; }

  const skip = (page - 1) * limit;

  const [restaurants, total] = await Promise.all([
    Restaurant.find(filter)
      .populate('owner', 'name email')
      .skip(skip)
      .limit(Number(limit))
      .sort({ rating: -1 }),
    Restaurant.countDocuments(filter),
  ]);

  return {
    restaurants,
    pagination: {
      totalResults: total,
      page:         Number(page),
      limit:        Number(limit),
      totalPages:   Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single restaurant by ID (with its menu).
 * @param {string} restaurantId
 */
const getRestaurantById = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId)
    .populate('owner', 'name email')
    .populate('menu');

  if (!restaurant) {
    throw new AppError('Restaurant not found.', 404);
  }
  return restaurant;
};

/**
 * Find nearby restaurants within radius using MongoDB $geoNear or Haversine fallback.
 * @param {number|string} lat - Latitude
 * @param {number|string} lng - Longitude
 * @param {number|string} radius - Radius in meters (default: 5000)
 * @param {object} query - Optional filters (cuisine, minRating, name)
 */
const getNearbyRestaurants = async (lat, lng, radius = 5000, query = {}) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const maxDistance = parseFloat(radius) || 5000;

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new AppError('Valid latitude and longitude coordinates are required for nearby search.', 400);
  }

  const matchFilter = { isActive: true };
  if (query.cuisine) {
    matchFilter.cuisine = { $in: [new RegExp(query.cuisine, 'i')] };
  }
  if (query.minRating) {
    matchFilter.rating = { $gte: Number(query.minRating) };
  }
  if (query.name) {
    matchFilter.name = new RegExp(query.name, 'i');
  }

  let results = [];

  // Try MongoDB $geoNear aggregation first
  try {
    const pipeline = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          distanceField: 'distanceInMeters',
          maxDistance: maxDistance,
          spherical: true,
          query: matchFilter,
        },
      },
      {
        $sort: { distanceInMeters: 1, rating: -1 },
      },
      {
        $limit: 30,
      },
    ];

    results = await Restaurant.aggregate(pipeline);
  } catch (err) {
    console.warn('MongoDB $geoNear aggregation fallback:', err.message);
  }

  // If $geoNear yielded 0 results or encountered missing 2dsphere coordinates on older records:
  if (!results || results.length === 0) {
    const allRests = await Restaurant.find(matchFilter).lean();
    results = allRests.map((r) => {
      let rLat = latitude;
      let rLng = longitude;

      if (r.location?.coordinates && r.location.coordinates.length === 2) {
        [rLng, rLat] = r.location.coordinates;
      }

      const dist = Math.round(haversineDistanceMeters(latitude, longitude, rLat, rLng));
      return {
        ...r,
        distanceInMeters: dist,
      };
    });

    results = results.filter((r) => r.distanceInMeters <= maxDistance);
    results.sort((a, b) => a.distanceInMeters - b.distanceInMeters);
  }

  return results.map((r) => {
    const dist = Math.round(r.distanceInMeters || 0);
    const formattedDistance = dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`;
    return {
      ...r,
      _id: r._id,
      distanceInMeters: dist,
      formattedDistance,
      isOpen: r.isActive !== false,
    };
  });
};

/**
 * Update a restaurant (owner of that restaurant only).
 * @param {string} restaurantId
 * @param {string} ownerId
 * @param {object} updateData
 */
const updateRestaurant = async (restaurantId, ownerId, updateData) => {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    throw new AppError('Restaurant not found.', 404);
  }

  // Ownership check
  if (restaurant.owner.toString() !== ownerId.toString()) {
    throw new AppError('You are not authorized to update this restaurant.', 403);
  }

  const updated = await Restaurant.findByIdAndUpdate(restaurantId, updateData, {
    new: true,
    runValidators: true,
  });

  return updated;
};

/**
 * Delete a restaurant (admin only — soft delete by setting isActive: false).
 * @param {string} restaurantId
 */
const deleteRestaurant = async (restaurantId) => {
  const restaurant = await Restaurant.findByIdAndUpdate(
    restaurantId,
    { isActive: false },
    { new: true }
  );

  if (!restaurant) {
    throw new AppError('Restaurant not found.', 404);
  }

  return restaurant;
};

/**
 * Get restaurants owned by a specific user.
 * @param {string} ownerId
 */
const getMyRestaurants = async (ownerId) => {
  const restaurants = await Restaurant.find({ owner: ownerId }).sort({ createdAt: -1 });
  return restaurants;
};

/**
 * Seed top-rated restaurants and menu items into MongoDB.
 */
const seedRestaurants = async () => {
  const { RESTAURANTS_DATA } = require('../seeds/seedData');
  const MenuItem = require('../models/menuItem.model');
  const User = require('../models/user.model');

  let owner = await User.findOne({ role: 'owner' });
  if (!owner) {
    owner = await User.findOne();
  }
  if (!owner) {
    throw new AppError('No user found to assign as owner for seed data.', 400);
  }

  let createdCount = 0;
  let itemsCount = 0;

  for (const rData of RESTAURANTS_DATA) {
    let existing = await Restaurant.findOne({ name: rData.name });
    if (!existing) {
      existing = await Restaurant.create({
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
    }

    for (const item of rData.menu) {
      const existingItem = await MenuItem.findOne({ name: item.name, restaurant: existing._id });
      if (!existingItem) {
        await MenuItem.create({
          ...item,
          restaurant: existing._id,
          isAvailable: true,
        });
        itemsCount++;
      }
    }
  }

  return {
    restaurantsAdded: createdCount,
    menuItemsAdded: itemsCount,
    totalRestaurants: await Restaurant.countDocuments({ isActive: true }),
  };
};

module.exports = {
  createRestaurant,
  getAllRestaurants,
  getRestaurantById,
  getNearbyRestaurants,
  updateRestaurant,
  deleteRestaurant,
  getMyRestaurants,
  seedRestaurants,
};
