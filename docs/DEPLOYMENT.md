# Deployment Guide

## Backend (Render.com)
1. Link your GitHub repo.
2. Set **Root Directory** to `backend`.
3. Configure the following **Environment Variables**:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (Get from Stripe Webhook setup)
   - `FIREBASE_PROJECT_ID`: `tattoo-generator-87f36`
   - `FIREBASE_SERVICE_ACCOUNT`: (The full JSON key from Firebase)
   - `NANO_BANANA_API_KEY`: (Your Google Gemini Key)
   - `FRONTEND_URL`: `https://tattoo-generator-87f36.web.app`

## Frontend (Firebase Hosting)
1. Run `npm install firebase-tools` locally.
2. Update `BACKEND_URL` in `frontend/script.js` to your Render URL.
3. Run `npx firebase deploy --only hosting`.

## Stripe Webhook Setup
1. Point Stripe to: `https://your-backend.onrender.com/api/stripe-webhook`.
2. Select only the `checkout.session.completed` event.
