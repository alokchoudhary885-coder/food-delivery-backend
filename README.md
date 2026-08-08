# 🍔 Food Delivery Backend

A production-ready REST API for a food delivery platform built with **Node.js**, **Express.js**, **MongoDB Atlas**, and **Mongoose**.

## 🏗️ Architecture

MVC pattern extended with a **Services layer** for reusable business logic.

```
food-delivery-backend/
├── src/
│   ├── config/          # DB, env, and 3rd-party configs
│   ├── models/          # Mongoose schemas
│   ├── controllers/     # Route handlers (thin layer)
│   ├── services/        # Business logic
│   ├── routes/          # Express routers (versioned)
│   ├── middlewares/     # Auth, errors, rate-limiting
│   ├── utils/           # Pure helper functions
│   └── validators/      # Joi request validation schemas
├── .env.example         # Copy to .env and fill in values
├── server.js            # Entry point
└── package.json
```

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Then edit .env with your MongoDB Atlas URI and JWT secret

# 3. Start development server
npm run dev
```

## 🌱 Environment Variables

See [.env.example](.env.example) for all required variables.

## 📦 Tech Stack

| Tool | Purpose |
|---|---|
| Express.js | HTTP framework |
| Mongoose | MongoDB ODM |
| Joi | Request validation |
| JWT | Authentication |
| bcryptjs | Password hashing |
| Helmet | Security headers |
| Morgan | HTTP logging |
| express-rate-limit | Brute-force protection |

## 📡 API Version

All routes are prefixed with `/api/v1/`
