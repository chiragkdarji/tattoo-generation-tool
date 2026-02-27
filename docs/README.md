# Tattoo AI Generation Tool - Documentation

## Project Overview
A professional web application for generating hyper-realistic tattoo mockups and their corresponding stencils.

### Core Features:
- **AI Tattoo Generation**: High-resolution image generation using Gemini 2.5 Flash.
- **Stencil Extraction**: Automatic processing using OpenCV (Python script) to generate tattooing stencils.
- **Credit System**: Users receive 250 initial credits; each generation costs 50 credits.
- **Monetization**: Integrated Stripe Checkout for purchasing 1500 credits for $49.99.
- **History Tracking**: All generations are saved to Firestore and linked to the user's account.

## Documentation Index
1. [Architecture & Technology Stack](ARCHITECTURE.md)
2. [Setup & Installation](SETUP_GUIDE.md)
3. [API Reference](API_REFERENCE.md)
4. [Monetization & Credit System](CREDIT_SYSTEM.md)
5. [Deployment Guide](DEPLOYMENT.md)
