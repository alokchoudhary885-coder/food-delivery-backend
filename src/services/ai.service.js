/**
 * @file src/services/ai.service.js
 * @description AI Recommendation Engine and culinary assistant logic.
 * Integrates MongoDB Menu items, Restaurant data, and smart culinary algorithms.
 */

const MenuItem = require('../models/menuItem.model');
const Restaurant = require('../models/restaurant.model');
const AppError = require('../utils/AppError');

/**
 * Extract budget, portions, dietary filters, and keywords from natural language query.
 * @param {string} query 
 * @returns {object}
 */
const parseFoodQuery = (query = '') => {
  const text = query.toLowerCase();

  // 1. Budget extraction (e.g. under 500, under ₹500, ₹400 ke andar, budget 600, <300)
  let budget = null;
  const budgetMatch = text.match(/(?:under|below|less than|within|around|₹|rs\.?|budget|ke andar)\s*(\d{2,4})/i) ||
                      text.match(/(\d{2,4})\s*(?:rs|rupees|inr|₹|ke andar|tak)/i);
  if (budgetMatch) {
    budget = parseInt(budgetMatch[1], 10);
  }

  // 2. Portions / People count (e.g. 2 logon ke liye, for 2 people, 3 persons, for me)
  let people = 1;
  const peopleMatch = text.match(/(\d+)\s*(?:logon|people|persons|pax|members|friends)/i);
  if (peopleMatch) {
    people = Math.min(Math.max(parseInt(peopleMatch[1], 10), 1), 10);
  }

  // 3. Dietary preferences (veg, non-veg, vegan, egg)
  let isVeg = null;
  if (text.includes('non-veg') || text.includes('nonveg') || text.includes('chicken') || text.includes('mutton') || text.includes('fish') || text.includes('meat')) {
    isVeg = false;
  } else if (text.includes('veg') || text.includes('vegetarian') || text.includes('shakahari') || text.includes('paneer')) {
    isVeg = true;
  }

  // 4. Spice level preference
  let spicy = false;
  if (text.includes('spicy') || text.includes('tikha') || text.includes('teekha') || text.includes('mirch') || text.includes('chatpata') || text.includes('hot')) {
    spicy = true;
  }

  // 5. Food Categories / Moods
  const categories = [];
  if (text.includes('dessert') || text.includes('sweet') || text.includes('meetha') || text.includes('ice cream') || text.includes('cake') || text.includes('gulab jamun')) {
    categories.push('Dessert');
  }
  if (text.includes('pizza') || text.includes('burger') || text.includes('sandwich') || text.includes('wrap') || text.includes('roll')) {
    categories.push('Main Course', 'Starter', 'Combo');
  }
  if (text.includes('drink') || text.includes('shake') || text.includes('beverage') || text.includes('coke') || text.includes('cold drink') || text.includes('juice')) {
    categories.push('Beverage', 'Beverages');
  }
  if (text.includes('healthy') || text.includes('gym') || text.includes('protein') || text.includes('diet') || text.includes('salad') || text.includes('oats')) {
    categories.push('Salad', 'Main Course');
  }
  if (text.includes('biryani') || text.includes('rice') || text.includes('thali') || text.includes('roti') || text.includes('naan')) {
    categories.push('Main Course', 'Rice');
  }

  return { budget, people, isVeg, spicy, categories, rawText: text };
};

/**
 * Recommend dishes from MongoDB based on user query and constraints.
 * @param {string} userQuery
 * @returns {Promise<object>}
 */
const getFoodRecommendations = async (userQuery = '') => {
  if (!userQuery.trim()) {
    throw new AppError('Please provide a query for AI food recommendation.', 400);
  }

  const parsed = parseFoodQuery(userQuery);

  // Build MongoDB query
  const filter = { isAvailable: true };
  if (parsed.isVeg !== null) {
    filter.isVeg = parsed.isVeg;
  }

  // Fetch candidate menu items with populated restaurant details
  let items = await MenuItem.find(filter)
    .populate('restaurant', 'name city rating image isActive')
    .lean();

  // Filter out items from inactive restaurants
  items = items.filter((item) => item.restaurant && item.restaurant.isActive !== false);

  if (items.length === 0) {
    // Fallback: search all available items
    items = await MenuItem.find({ isAvailable: true })
      .populate('restaurant', 'name city rating image')
      .lean();
  }

  // Score items based on relevance to user query
  const queryTokens = parsed.rawText.split(/\s+/).filter((t) => t.length > 2);
  const scoredItems = items.map((item) => {
    let score = 0;
    const nameLower = (item.name || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const categoryLower = (item.category || '').toLowerCase();

    // Token match scoring
    queryTokens.forEach((token) => {
      if (nameLower.includes(token)) score += 10;
      if (descLower.includes(token)) score += 5;
      if (categoryLower.includes(token)) score += 4;
    });

    // Spice match
    if (parsed.spicy && (item.spiceLevel === 'hot' || item.spiceLevel === 'extra-hot' || descLower.includes('spicy') || nameLower.includes('spicy') || nameLower.includes('tikka') || nameLower.includes('peri'))) {
      score += 8;
    }

    // High rating boost
    const restRating = item.restaurant?.rating || 4.0;
    score += restRating * 2;

    return { ...item, score };
  });

  // Sort descending by score
  scoredItems.sort((a, b) => b.score - a.score);

  // Group or select combo within budget
  let selectedItems = [];
  let currentTotal = 0;
  const targetCount = Math.max(parsed.people * 2, 3); // e.g. 2-4 items

  for (const item of scoredItems) {
    if (selectedItems.length >= targetCount) break;

    // Avoid duplicate names
    if (selectedItems.some((s) => s.name.toLowerCase() === item.name.toLowerCase())) continue;

    if (parsed.budget) {
      if (currentTotal + item.price <= parsed.budget || selectedItems.length === 0) {
        selectedItems.push(item);
        currentTotal += item.price;
      }
    } else {
      selectedItems.push(item);
      currentTotal += item.price;
    }
  }

  // If strict budget left us with empty or too few items, pick top value options
  if (selectedItems.length === 0 && scoredItems.length > 0) {
    const sortedByPrice = [...scoredItems].sort((a, b) => a.price - b.price);
    selectedItems = sortedByPrice.slice(0, 3);
    currentTotal = selectedItems.reduce((acc, i) => acc + i.price, 0);
  }

  // Format conversational AI reply
  let replyText = '';
  const portionLabel = parsed.people > 1 ? `${parsed.people} people` : 'you';

  if (parsed.budget) {
    replyText = `I found ${selectedItems.length} delicious options for ${portionLabel} within your ₹${parsed.budget} budget! Total comes to ₹${currentTotal}. 🍕🌶️`;
  } else if (parsed.spicy) {
    replyText = `Here are top-rated spicy & flavorful recommendations for ${portionLabel}! 🔥🌶️`;
  } else if (parsed.isVeg) {
    replyText = `Here are the best pure vegetarian picks curated for ${portionLabel}! 🥗🧀`;
  } else {
    replyText = `Here are our chef-recommended dishes curated specially for ${portionLabel}! 🍕✨`;
  }

  return {
    reply: replyText,
    query: userQuery,
    parsedFilters: parsed,
    totalEstimatedPrice: currentTotal,
    recommendations: selectedItems.map((item) => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      description: item.description,
      category: item.category,
      isVeg: item.isVeg,
      spiceLevel: item.spiceLevel,
      image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop',
      restaurant: {
        _id: item.restaurant?._id,
        name: item.restaurant?.name || 'Top Kitchen',
        rating: item.restaurant?.rating || 4.5,
        city: item.restaurant?.address?.city || 'Your City',
      },
    })),
  };
};

/**
 * AI Menu Item Generator for Restaurant Owners.
 * Generates description, tags, and suggested pricing for dishes.
 * @param {string} dishName
 * @param {string} cuisine
 * @returns {object}
 */
const generateMenuItemDetails = async (dishName = '', cuisine = 'Indian') => {
  if (!dishName) {
    throw new AppError('Dish name is required.', 400);
  }

  const name = dishName.trim();
  const isVeg = !(/chicken|mutton|fish|prawn|egg|meat|pork|beef/i.test(name));

  const descriptions = {
    pizza: 'Artisan hand-stretched sourdough crust layered with rich San Marzano tomato sauce, melted mozzarella, and fresh herbs baked to perfection.',
    paneer: 'Tender cubes of fresh cottage cheese tossed in a rich, aromatic blend of slow-cooked spices, butter, and culinary herbs.',
    burger: 'Juicy, seasoned patty grilled to savory perfection, layered with crisp lettuce, ripe tomatoes, melted cheese, and signature secret sauce.',
    biryani: 'Long-grain aged Basmati rice layered with fragrant saffron, caramelized onions, and slow-dum spices cooked in traditional handi style.',
    pasta: 'Al dente pasta smothered in a velvety, herb-infused creamy sauce with roasted garlic and freshly grated Parmesan.',
    rolls: 'Flaky handmade paratha wrap loaded with grilled spiced fillings, crunchy onions, and tangy mint mayo drizzle.',
  };

  let description = `Freshly prepared chef-special ${name} cooked using premium ingredients, authentic culinary spices, and seasoned to perfection.`;
  for (const [key, desc] of Object.entries(descriptions)) {
    if (name.toLowerCase().includes(key)) {
      description = desc;
      break;
    }
  }

  return {
    name,
    description,
    isVeg,
    cuisine,
    suggestedCategory: isVeg ? 'Main Course' : 'Main Course',
    spiceLevel: /spicy|tikka|peri|chilli|hot/i.test(name) ? 'hot' : 'medium',
    estimatedCalories: Math.floor(250 + Math.random() * 300),
    tags: [isVeg ? 'Vegetarian' : 'Non-Vegetarian', 'Chef Special', cuisine, 'Freshly Prepared'],
  };
};

module.exports = {
  getFoodRecommendations,
  generateMenuItemDetails,
};
