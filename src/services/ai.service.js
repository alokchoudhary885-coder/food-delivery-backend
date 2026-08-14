/**
 * @file src/services/ai.service.js
 * @description FoodRush Level 3 Location-Aware Conversational Food AI & Autonomous Ordering Engine.
 * Supports:
 * 1. Social & Conversational Chitchat (Thanks, Greetings, Help, Capabilities)
 * 2. Location-Aware Discovery using Backend Restaurant Service
 * 3. Mood & Scenario-Based Food Recommendations (Party, Sad/Comfort, Romantic, Rainy/Monsoon, Late Night)
 * 4. Live Restaurant Directory & Ratings Inquiries
 * 5. Order Tracking, Delivery & Payment FAQs
 * 6. Multi-Turn Conversation Memory & Autonomous Direct Cart Actions
 */

const MenuItem = require('../models/menuItem.model');
const Restaurant = require('../models/restaurant.model');
const restaurantService = require('./restaurant.service');
const AppError = require('../utils/AppError');

/**
 * Analyze intent, sentiment, context, and entities from user query.
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

  // 1. Social: Gratitude (thank you, thanks, shukriya, dhanyawad)
  if (/^(thank\s*you|thanks|thx|shukriya|dhanyawad|great|awesome|badhiya|shukriyaa|thanku|thankyou)/i.test(text)) {
    return { intent: 'GRATITUDE', rawText: text };
  }

  // 2. Social: Greetings & Identity (hi, hello, namaste, kaun ho tum, help, kya kar sakte ho)
  if (/^(hi|hello|hey|namaste|hlo|helo|kaun ho|who are you|tum kaun ho|aap kaun ho|kya kar sakte ho|help|features|guide)/i.test(text)) {
    return { intent: 'GREETING_OR_IDENTITY', rawText: text };
  }

  // 3. Order & Support FAQ (mera order kahan hai, delivery time, payment options, cod)
  if (/mera order|order track|order kahan|track order|delivery time|kab tak aayega|payment options|cod|online payment/i.test(text)) {
    return { intent: 'ORDER_SUPPORT_FAQ', rawText: text };
  }

  // 4. Restaurant Inquiries (best restaurant, kaunsa restaurant acha hai, restaurant list)
  if (/best restaurant|top restaurant|kaun sa restaurant|restaurants list|open restaurants|restaurant dikhao/i.test(text)) {
    return { intent: 'RESTAURANT_INQUIRY', rawText: text };
  }

  // 5. Checkout Intent (checkout karo, order place karo, pay karna hai, cart kholo)
  if (/checkout|order place|place order|bill kitna|pay karna|cart kholo|go to cart/i.test(text)) {
    return { intent: 'CHECKOUT', rawText: text };
  }

  // 6. Add All from last recommendations
  if (/sab.*cart|all.*cart|poora.*add|sab add|sab dal do|sab daalo/i.test(text) && lastRecommendations.length > 0) {
    return {
      intent: 'ADD_ALL_LAST',
      targetItems: lastRecommendations,
      rawText: text,
    };
  }

  // 7. Ordinal reference from last recommendations (e.g. "second wala add karo", "first item")
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

  // 8. Refinement Intent ("isme se sasta", "isme se ₹300 ke andar", "sirf veg dikhao")
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

  // 9. Location Radius extraction (e.g. "3 km ke andar", "5 km ke andar", "nearby")
  let radiusInMeters = null;
  const radiusMatch = text.match(/(\d+)\s*(?:km|kilo\s*meter|kms)/i);
  if (radiusMatch) {
    radiusInMeters = parseInt(radiusMatch[1], 10) * 1000;
  } else if (/mere paas|nearby|aas paas|close by|around me/i.test(text)) {
    radiusInMeters = 5000;
  }

  // 10. Mood & Scenario Detection
  let mood = null;
  if (/mood off|sad|upset|boring|stressed|khush nahi/i.test(text)) mood = 'COMFORT_FOOD';
  else if (/party|dost|friends|celebration|match/i.test(text)) mood = 'PARTY';
  else if (/rain|barish|monsoon|mausam/i.test(text)) mood = 'RAINY';
  else if (/romantic|date|candle|couple/i.test(text)) mood = 'ROMANTIC';
  else if (/late night|raat ko|midnight|bhook lag rahi/i.test(text)) mood = 'LATE_NIGHT';
  else if (/tired|thak gaya|lazy|aaj cook nahi karna/i.test(text)) mood = 'QUICK_MEAL';

  // 11. Direct Item Add to Cart
  const isDirectAdd = /add.*cart|cart.*add|daal do|daalo|chahiye|order karo/i.test(text);

  // Budget extraction
  let budget = null;
  const budgetMatch = text.match(/(?:under|below|less than|within|around|₹|rs\.?|budget|ke andar)\s*(\d{2,4})/i) ||
                      text.match(/(\d{2,4})\s*(?:rs|rupees|inr|₹|ke andar|tak)/i);
  if (budgetMatch) budget = parseInt(budgetMatch[1], 10);

  // People count
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
    radiusInMeters,
    mood,
    budget,
    people,
    isVeg,
    spicy,
    rawText: text,
  };
};

/**
 * Main FoodieBot AI Recommendation & Conversation Engine.
 */
const getFoodRecommendations = async (userQuery = '', conversationHistory = [], userLocation = null) => {
  if (!userQuery || !userQuery.trim()) {
    throw new AppError('Please provide a query for FoodieBot AI.', 400);
  }

  const analysis = analyzeIntentAndEntities(userQuery, conversationHistory);

  // ── 1. Handle Gratitude & Courtesy ─────────────────────────────────────
  if (analysis.intent === 'GRATITUDE') {
    return {
      intent: 'CONVERSATION',
      reply: 'Aapka bahut-bahut swagat hai! 😊 FoodRush se kuch aur order karne ya food suggestion ke liye main hamesha hazir hoon. Enjoy your meal! 🍕❤️',
      recommendations: [],
    };
  }

  // ── 2. Handle Greetings & Capabilities ─────────────────────────────────
  if (analysis.intent === 'GREETING_OR_IDENTITY') {
    return {
      intent: 'CONVERSATION',
      reply: `Namaste! 👋 Main hoon FoodieBot 🤖, aapka personal FoodRush AI assistant!\n\nMain aapke liye ye sab kar sakta hoon:\n• 📍 Aapke location ke nearby open restaurants se food dhoondhna\n• 🍕 Mood, budget ya portion ke hisab se food recommend karna\n• 🏪 Top-rated restaurants & best dishes batana\n• 🛒 Direct bol kar ya likh kar cart mein dishes add karwana\n• 📦 Orders, delivery time aur payment ki details dena!\n\nAaj aapka kya khane ka man hai?`,
      recommendations: [],
    };
  }

  // ── 3. Handle Order Tracking & Delivery Support FAQ ─────────────────────
  if (analysis.intent === 'ORDER_SUPPORT_FAQ') {
    return {
      intent: 'CONVERSATION',
      reply: `📦 **FoodRush Order & Delivery Details**:\n\n• **Order Status**: Aap apna live order top bar mein **"My Orders"** page par track kar sakte hain.\n• **Delivery Time**: Average delivery time **30 se 40 minutes** rehta hai.\n• **Payment Modes**: Aap Razorpay (UPI, Cards, NetBanking) ya Cash on Delivery (COD) dono se pay kar sakte hain! 💳🛵`,
      recommendations: [],
    };
  }

  // ── 4. Handle Restaurant Inquiries ─────────────────────────────────────
  if (analysis.intent === 'RESTAURANT_INQUIRY') {
    let restaurants = [];
    if (userLocation?.lat && userLocation?.lng) {
      try {
        restaurants = await restaurantService.getNearbyRestaurants(userLocation.lat, userLocation.lng, 10000);
      } catch {
        restaurants = [];
      }
    }

    if (!restaurants || restaurants.length === 0) {
      restaurants = await Restaurant.find({ isActive: true })
        .select('name city rating cuisine address')
        .sort({ rating: -1 })
        .limit(5)
        .lean();
    }

    if (restaurants.length > 0) {
      const restList = restaurants.slice(0, 5).map((r, i) => {
        const distStr = r.formattedDistance ? ` • 📍 ${r.formattedDistance}` : '';
        return `#${i + 1} 🏪 **${r.name}** (⭐ ${r.rating || 4.5})${distStr}`;
      }).join('\n');

      return {
        intent: 'CONVERSATION',
        reply: `FoodRush par top-rated restaurants ye hain:\n\n${restList}\n\nInme se kisi ka menu dekhna ho ya dish order karni ho to mujhe batayein! 🍕`,
        recommendations: [],
      };
    }
  }

  // ── 5. Handle Direct Checkout Trigger ──────────────────────────────────
  if (analysis.intent === 'CHECKOUT') {
    return {
      intent: 'CHECKOUT',
      reply: 'Bilkul! Main aapko seedha Checkout page par le jaa raha hoon. 🛒💳',
      action: { type: 'NAVIGATE_CHECKOUT' },
      recommendations: [],
    };
  }

  // ── 6. Handle Add All Last Recommendations ─────────────────────────────
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

  // ── 7. Handle Add Ordinal Item ("Second wala add karo") ─────────────────
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

  // ── 8. Handle Refinement ("Isse sasta option") ──────────────────────────
  if (analysis.intent === 'REFINE_LAST') {
    let filtered = [...analysis.lastRecommendations];
    if (analysis.maxPrice) filtered = filtered.filter((i) => i.price <= analysis.maxPrice);
    if (analysis.isVegOnly) filtered = filtered.filter((i) => i.isVeg);
    filtered.sort((a, b) => a.price - b.price);

    const reply = filtered.length > 0
      ? `Maine pichle suggestions mein se aapke liye ye best options filter kiye hain! 🍕👇`
      : `Pichle recommendations mein se is filter ke hisab se koi item nahi mila, par ye best value options hain:`;

    return {
      intent: 'RECOMMEND',
      reply,
      recommendations: filtered.length > 0 ? filtered : analysis.lastRecommendations.slice(0, 2),
      totalEstimatedPrice: filtered.reduce((s, i) => s + (i.price || 0), 0),
    };
  }

  // ── 9. Location-Aware Nearby Restaurants Resolution ────────────────────
  let allowedRestaurantIds = null;
  let nearbyRestaurantMap = {};

  if (userLocation?.lat && userLocation?.lng) {
    const radiusToUse = analysis.radiusInMeters || 10000;
    try {
      const nearbyRests = await restaurantService.getNearbyRestaurants(userLocation.lat, userLocation.lng, radiusToUse);
      if (nearbyRests && nearbyRests.length > 0) {
        allowedRestaurantIds = nearbyRests.map((r) => r._id);
        nearbyRests.forEach((r) => {
          nearbyRestaurantMap[r._id.toString()] = r;
        });
      }
    } catch (err) {
      console.warn('AI nearby restaurants lookup fallback:', err.message);
    }
  }

  // Build items query
  const filter = { isAvailable: true };
  if (analysis.isVeg !== null) filter.isVeg = analysis.isVeg;
  if (allowedRestaurantIds && allowedRestaurantIds.length > 0) {
    filter.restaurant = { $in: allowedRestaurantIds };
  }

  let allItems = await MenuItem.find(filter)
    .populate('restaurant', 'name city rating image isActive location')
    .lean();

  allItems = allItems.filter((i) => i.restaurant && i.restaurant.isActive !== false);

  // Fallback if no items found in strict nearby radius
  if (allItems.length === 0) {
    const fallbackFilter = { isAvailable: true };
    if (analysis.isVeg !== null) fallbackFilter.isVeg = analysis.isVeg;
    allItems = await MenuItem.find(fallbackFilter)
      .populate('restaurant', 'name city rating image isActive location')
      .lean();
    allItems = allItems.filter((i) => i.restaurant && i.restaurant.isActive !== false);
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

    if (analysis.spicy && (item.spiceLevel === 'hot' || item.spiceLevel === 'extra-hot' || nameLower.includes('spicy') || descLower.includes('spicy') || nameLower.includes('tikka'))) {
      score += 10;
    }

    // Mood boosts
    if (analysis.mood === 'COMFORT_FOOD' && (/dessert|pizza|pasta|chocolate|cake|brownie|shake/i.test(nameLower) || catLower === 'dessert')) {
      score += 15;
    }
    if (analysis.mood === 'PARTY' && (/pizza|burger|roll|combo|starter/i.test(nameLower) || catLower === 'combo' || catLower === 'starter')) {
      score += 15;
    }
    if (analysis.mood === 'RAINY' && (/starter|roll|tikka|chai|pakora|crispy|hot/i.test(nameLower) || catLower === 'starter')) {
      score += 15;
    }

    score += (item.restaurant?.rating || 4.0) * 2;

    // Attach nearby formatted distance if available
    const restIdStr = item.restaurant?._id?.toString();
    const distanceInfo = nearbyRestaurantMap[restIdStr];
    if (distanceInfo?.formattedDistance) {
      score += 8; // Prioritize closer restaurants
    }

    return {
      ...item,
      score,
      formattedDistance: distanceInfo?.formattedDistance || null,
    };
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

  // Format tailored conversational reply
  let replyText = '';
  const portionLabel = (analysis.people || 1) > 1 ? `${analysis.people} people` : 'you';
  const nearbyTag = analysis.radiusInMeters ? ` (${(analysis.radiusInMeters / 1000)} km ke andar)` : (userLocation ? ' nearby' : '');

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

  if (analysis.mood === 'COMFORT_FOOD') {
    replyText = `Mood theek karne ke liye ye delicious comfort food dishes${nearbyTag} aapka mood instant fresh kar dengi! 🍫🍕✨`;
  } else if (analysis.mood === 'PARTY') {
    replyText = `Party aur doston ke liye perfect party feast recommendations${nearbyTag}! 🎉🍕🥤`;
  } else if (analysis.mood === 'RAINY') {
    replyText = `Barish ke mausam ke liye hot & crispy delicious picks${nearbyTag}! 🌧️☕🥟`;
  } else if (analysis.budget) {
    replyText = `Maine aapke ₹${analysis.budget} budget mein ${portionLabel} ke liye ye best options${nearbyTag} curate kiye hain (Total: ₹${currentTotal})! 🍕🌶️`;
  } else if (analysis.spicy) {
    replyText = `Aapke liye spicy aur flavorful top-rated dishes${nearbyTag} ready hain! 🔥🌶️`;
  } else {
    replyText = `Here are chef-special recommendations${nearbyTag} curated for ${portionLabel}! 🍕✨`;
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
      formattedDistance: item.formattedDistance || null,
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
