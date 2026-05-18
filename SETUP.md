# Lumi — Local Setup Guide

## What you need installed
- **Node.js** 18+ and **Yarn** (`npm install -g yarn`)
- **Python** 3.11+
- **Expo Go** app on your phone (for testing)
- **MongoDB** — free Atlas cluster or local install

---

## 1. Backend setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your environment variables
cp .env.example .env
# Edit .env with your MongoDB URL, JWT secret, and API keys

# Start the server
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be at: `http://localhost:8000`  
Swagger docs at: `http://localhost:8000/docs`

---

## 2. Frontend setup

```bash
cd frontend

# Install dependencies
yarn install

# Copy and fill in your environment variables
cp .env.example .env
# Set EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8000
# (use your machine's local IP, not localhost, so your phone can reach it)
# Find your IP: ifconfig | grep "inet " on Mac, ipconfig on Windows

# Start Expo
yarn start
```

Scan the QR code with **Expo Go** on your phone.

---

## 3. Getting API keys

| Service | Where to get it | Cost |
|---------|----------------|------|
| MongoDB Atlas | cloud.mongodb.com | Free tier |
| Anthropic (AI) | console.anthropic.com | Pay per use (~$1 for hundreds of requests) |
| Stripe | stripe.com | Free test mode |

---

## 4. What works without API keys

- Discovery feed, filters, wishlist, cart ✅
- Style quiz ✅  
- Store links (opens retailer search in browser) ✅
- Face scan AI — needs Anthropic key
- AI Stylist — needs Anthropic key
- Checkout — needs Stripe key

---

## Recent fixes (May 2026)
- **Images**: Each product now has its own matched Unsplash image instead of cycling through a pool
- **Store links**: "Shop This Item" now opens a product search on the brand's official website (e.g. searches Zara for "Cargo Pants"), opens in an in-app browser so you stay in Lumi
- **Retailer URLs**: Stored directly on each product in the database for faster lookup
