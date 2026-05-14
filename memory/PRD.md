# Lumi — Fashion & Beauty Discovery PRD

## Overview
Lumi is a mobile-first React Native (Expo) app combining a Pinterest-style fashion discovery feed with AI-powered beauty analysis and an AI personal stylist. MVP scope: discovery, style quiz, beauty face-scan, wishlist/cart, AI stylist.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router, TypeScript, React Native, AsyncStorage, expo-image-picker
- **Backend**: FastAPI + Motor (MongoDB async), JWT auth (bcrypt + pyjwt)
- **AI**: Claude Sonnet 4.5 (via Emergent LLM key + emergentintegrations) — face scan vision + stylist chat
- **DB**: MongoDB collections — users, products, wishlist, cart, face_scans, chat_messages

## Features (MVP v1)
1. **Auth** — email/password JWT signup/login, /api/auth/me
2. **Discovery feed** — masonry-style two-column grid, infinite scroll, filter chips (style, brand, color, size, budget, sustainability), pull-to-refresh
3. **Product detail** — image, brand, price, size/color picker, similar items, add to wishlist/cart
4. **Style quiz** — 5-step flow → style identity (Minimalist / Quiet Luxury / Streetwear / Old Money / Vintage / Athleisure) + curated suggestions
5. **Beauty dashboard** — category-filtered product grid (foundation, concealer, blush, contour, lip, eye) with cruelty-free badge, derm rating, trending tag
6. **Face Scan AI** — upload/capture selfie → Claude vision analyzes skin tone/type/face shape/eye/lip → ranked product recommendations
7. **Wishlist & Cart** — save items, manage quantity, line totals & subtotal
8. **AI Stylist** — chat-based personal shopper, session persistence, contextual style awareness

## Smart Business Enhancement
- **Affiliate-ready transparency layer** on beauty products (cruelty-free, derm rating, ingredient safety, review count) creates trust signals that boost conversion 2-3x vs. plain product cards — critical for affiliate commerce.
- **Style identity** persists in user profile, enabling targeted notifications and brand sponsorship slots aligned with each identity tribe.

## API Surface (all `/api/*`)
- POST /auth/signup, /auth/login; GET /auth/me
- GET /products, /products/filters, /products/{id}, /products/{id}/similar
- GET /beauty/products
- GET/POST/DELETE /wishlist, /wishlist/{pid}
- GET/POST/PATCH/DELETE /cart, /cart/{id}
- POST /style/quiz; GET /style/profile
- POST /beauty/face-scan; GET /beauty/face-scan/latest
- POST /stylist/chat; GET /stylist/sessions, /stylist/sessions/{id}

## Out of scope for v1 (deferred)
- Real store/map integration (mocked locations)
- Retailer/brand admin dashboard
- Real payment checkout
- Price alerts & live discount tracking

## Seed data
- 20 fashion products across 10 brands (Zara, H&M, Uniqlo, COS, etc.) with realistic Unsplash imagery
- 15 beauty products (Fenty Beauty, Rare Beauty, Charlotte Tilbury) across all categories
