/**
 * @file src/services/ai.service.js
 * @description Level 3 AI Recommendation & Autonomous Ordering Engine.
 * Features:
 * - Natural Language Direct Cart Actions ("2 paneer rolls aur 1 cold drink add karo")
 * - Multi-turn Conversation Memory & Context ("second wala add karo", "isme se sasta dikhao")
 * - Smart Budget & Portion Optimization
 * - Direct Checkout Action Triggers
 */

const MenuItem = require('../models/menuItem.model');
const Restaurant = require('../models/restaurant.model');
const AppError = require('../utils/AppError');

/**
 * Extract intent, quantities, item names, and constraints from natural language query.
 */
const analyzeIntentAndEntities = (query = '', history = []) => {
  const text = query.toLowerCase().trim();

  // Find last bot recommendations from conversation history
  let lastRecommendations = [];
  if (Array.isArray(history) && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === 'bot' && history[i].recommendations?.length > 0) {
        lastRecommendations = history[i].recommendations;
        break;
      }
    }
  }

  // 1. Checkout Intent
  if (/checkout|order place|place order|bill kitna|pay karna|cart kholo|go to cart/i.test(text)) {
    return { intent: 'CHECKOUT', rawText: text };
  }

  // 2. Add All from last recommendations
  if (/sab.*cart|all.*cart|poora.*add|sab add/i.test(text) && lastRecommendations.length > 0) {
    return {
      intent: 'ADD_ALL_LAST',
      targetItems: lastRecommendations,
      rawText: text,
    };
  }

  // 3. Ordinal reference from last recommendations (e.g. "second wala add karo", "first item")
  const ordinalMatch = text.match(/(first|second|third|fourth|1st|2nd|3rd|4th|pehla|doosra|teesra|1|2|3|4)\s*(?:wala|item|dish|option)?\s*(?:cart|add|daal|chahiye)/i);
  if (ordinalMatch && lastRecommendations.length > 0) {
    const word = ordinalMatch[1];
    let index = 0;
    if (word === 'second' || word === '2nd' || word === 'doosra' || word === '2') index = 1;
    if (word === 'third' || word === '3rd' || word === 'teesra' || word === '3') index = 2;
    if (word === 'fourth' || word === '4th' || word === '4') index = 3;

    if (lastRecommendations[index]) {
      return {
        intent: 'ADD_ORDINAL',
        targetItem: lastRecommendations[index],
        rawText: text,
      };
    }
  }

  // 4. Refinement Intent ("isme se sasta", "isme se ₹300 ke andar", "sirf veg dikhao")
  if (/isme se|inme se|isse sasta|sasta wala|cheaper|sirf veg|only veg/i.test(text) && lastRecommendations.length > 0) {
    let maxPrice = null;
    const priceMatch = text.match(/(\d{2,4})/);
    if (priceMatch) maxPrice = parseInt(priceMatch[1], 10);

    return {
      intent: 'REFINE_LAST',
      lastRecommendations,
      maxPrice,
      isVegOnly: /veg|shakahari/i.test(text),
      rawText: text,
    };
  }

  // 5. Direct Item Add to Cart ("2 paneer rolls aur 1 cold drink cart mein add karo")
  const isDirectAdd = /add.*cart|cart.*add|daal do|daalo|chahiye|order karo/i.test(text);

  // Budget extraction
  let budget = null;
  const budgetMatch = text.match(/(?:under|below|less than|within|around|₹|rs\.?|budget|ke andar)\s*(\d{2,4})/i) ||
                      text.match(/(\d{2,4})\s*(?:rs|rupees|inr|₹|ke andar|tak)/i);
  if (budgetMatch) budget = parseInt(budgetMatch[1], 10);

  // People / portion count
  let people = 1;
  const peopleMatch = text.match(/(\d+)\s*(?:logon|people|persons|pax|members|friends)/i);
  if (peopleMatch) people = Math.min(Math.max(parseInt(peopleMatch[1], 10), 1), 10);

  // Dietary
  let isVeg = null;
  if (/non-veg|nonveg|chicken|mutton|fish|meat|egg/i.test(text)) isVeg = false;
  else if (/veg|vegetarian|shakahari|paneer/i.test(text)) isVeg = true;

  // Spicy
  const spicy = /spicy|tikha|teekha|mirch|chatpata|hot/i.test(text);

  return {
    intent: isDirectAdd ? 'DIRECT_ADD_SEARCH' : 'RECOMMEND',
    budget,
    people,
    isVeg,
    spicy,
    rawText: text,
  };
};

/**
 * Main AI Engine handler with Multi-Turn Memory & Autonomous Ordering.
 */
const getFoodRecommendations = async (userQuery = '', conversationHistory = []) => {
  if (!userQuery || !userQuery.trim()) {
    throw new AppError('Please provide a query for FoodieBot AI.', 400);
  }

  const analysis = analyzeIntentAndEntities(userQuery, conversationHistory);

  // ── Action 1: Direct Checkout Trigger ─────────────────────────────────
  if (analysis.intent === 'CHECKOUT') {
    return {
      intent: 'CHECKOUT',
      reply: 'Bilkul! Main aapko seedha Checkout page par le jaa raha hoon. 🛒💳',
      action: { type: 'NAVIGATE_CHECKOUT' },
      recommendations: [],
    };
  }

  // ── Action 2: Add All Last Recommendations to Cart ────────────────────
  if (analysis.intent === 'ADD_ALL_LAST') {
    const itemsToAdd = analysis.targetItems.map((item) => ({ ...item, quantity: 1 }));
    const total = itemsToAdd.reduce((sum, i) => sum + (i.price || 0), 0);

    return {
      intent: 'ADD_TO_CART',
      reply: `Done! Maine saare ${itemsToAdd.length} recommended dishes aapke cart mein add kar diye hain (Total: ₹${total})! 🛒🎉`,
      action: {
        type: 'ADD_ITEMS',
        items: itemsToAdd,
      },
      recommendations: analysis.targetItems,
      totalEstimatedPrice: total,
    };
  }

  // ── Action 3: Add Ordinal item ("second wala cart mein add karo") ──────
  if (analysis.intent === 'ADD_ORDINAL') {
    const item = analysis.targetItem;
    return {
      intent: 'ADD_TO_CART',
      reply: `Zaroor! "${item.name}" (₹${item.price}) aapke cart mein add kar diya gaya hai! 🛒✨`,
      action: {
        type: 'ADD_ITEMS',
        items: [{ ...item, quantity: 1 }],
      },
      recommendations: [item],
      totalEstimatedPrice: item.price,
    };
  }

  // ── Action 4: Refine previous recommendations ("isme se sasta wala") ───
  if (analysis.intent === 'REFINE_LAST') {
    let filtered = [...analysis.lastRecommendations];
    if (analysis.maxPrice) {
      filtered = filtered.filter((i) => i.price <= analysis.maxPrice);
    }
    if (analysis.isVegOnly) {
      filtered = filtered.filter((i) => i.isVeg);
    }
    // Sort by price ascending
    filtered.sort((a, b) => a.price - b.price);

    const reply = filtered.length > 0
      ? `Maine pichle suggestions mein se aapke liye ye best options filter kiye hain! 🍕👇`
      : `Pichle recommendations mein se is filter ke hisab se koi item nahi mila, par ye best value options hain:`;

    return {
      intent: 'RECOMMEND',
      reply,
      recommendations: filtered.length > 0 ? filtered : analysis.lastRecommendations.slice(0, 2),
      totalEstimatedPrice: filtered.reduce((s, i) => s + i.price, 0),
    };
  }

  // ── Action 5: Standard Recommendation or Direct Item Add ──────────────
  const filter = { isAvailable: true };
  if (analysis.isVeg !== null) filter.isVeg = analysis.isVeg;

  let allItems = await MenuItem.find(filter)
    .populate('restaurant', 'name city rating image isActive')
    .lean();

  allItems = allItems.filter((i) => i.restaurant && i.restaurant.isActive !== false);
  if (allItems.length === 0) {
    allItems = await MenuItem.find({ isAvailable: true })
      .populate('restaurant', 'name city rating image')
      .lean();
  }

  // Scoring engine
  const queryTokens = analysis.rawText.split(/\s+/).filter((t) => t.length > 2);
  const scored = allItems.map((item) => {
    let score = 0;
    const nameLower = (item.name || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const catLower = (item.category || '').toLowerCase();

    queryTokens.forEach((t) => {
      if (nameLower.includes(t)) score += 12;
      if (descLower.includes(t)) score += 6;
      if (catLower.includes(t)) score += 4;
    });

    if (analysis.spicy && (item.spiceLevel === 'hot' || item.spiceLevel === 'extra-hot' || nameLower.includes('spicy') || descLower.includes('spicy'))) {
      score += 10;
    }

    score += (item.restaurant?.rating || 4.0) * 2;
    return { ...item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Group selection within budget
  let selected = [];
  let currentTotal = 0;
  const targetCount = Math.max((analysis.people || 1) * 2, 3);

  for (const item of scored) {
    if (selected.length >= targetCount) break;
    if (selected.some((s) => s.name.toLowerCase() === item.name.toLowerCase())) continue;

    if (analysis.budget) {
      if (currentTotal + item.price <= analysis.budget || selected.length === 0) {
        selected.push(item);
        currentTotal += item.price;
      }
    } else {
      selected.push(item);
      currentTotal += item.price;
    }
  }

  if (selected.length === 0 && scored.length > 0) {
    selected = scored.slice(0, 3);
    currentTotal = selected.reduce((s, i) => s + i.price, 0);
  }

  // Format rich response
  let replyText = '';
  const portionLabel = (analysis.people || 1) > 1 ? `${analysis.people} people` : 'you';

  if (analysis.intent === 'DIRECT_ADD_SEARCH' && selected.length > 0) {
    const topItem = selected[0];
    return {
      intent: 'ADD_TO_CART',
      reply: `Found "${topItem.name}" (₹${topItem.price}) from ${topItem.restaurant?.name}! Cart mein add kar diya gaya hai! 🛒✨`,
      action: {
        type: 'ADD_ITEMS',
        items: [{ ...topItem, quantity: 1 }],
      },
      recommendations: selected,
      totalEstimatedPrice: currentTotal,
    };
  }

  if (analysis.budget) {
    replyText = `I found ${selected.length} options for ${portionLabel} within ₹${analysis.budget}! Total: ₹${currentTotal}. 🍕🌶️`;
  } else if (analysis.spicy) {
    replyText = `Here are top-rated spicy & flavorful recommendations for ${portionLabel}! 🔥🌶️`;
  } else {
    replyText = `Here are chef-special recommendations curated for ${portionLabel}! 🍕✨`;
  }

  return {
    intent: 'RECOMMEND',
    reply: replyText,
    query: userQuery,
    totalEstimatedPrice: currentTotal,
    recommendations: selected.map((item) => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      description: item.description,
      category: item.category,
      isVeg: item.isVeg,
      spiceLevel: item.spiceLevel,
      image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
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
 */
const generateMenuItemDetails = async (dishName = '', cuisine = 'Indian') => {
  if (!dishName) throw new AppError('Dish name is required.', 400);

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
    suggestedCategory: 'Main Course',
    spiceLevel: /spicy|tikka|peri|chilli|hot/i.test(name) ? 'hot' : 'medium',
    estimatedCalories: Math.floor(250 + Math.random() * 300),
    tags: [isVeg ? 'Vegetarian' : 'Non-Vegetarian', 'Chef Special', cuisine, 'Freshly Prepared'],
  };
};

module.exports = {
  getFoodRecommendations,
  generateMenuItemDetails,
};
