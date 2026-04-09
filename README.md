# Tattoo Suggest — AI Tattoo Design & Stencil Generator

Generate hyper-realistic tattoo mockups and downloadable stencils using AI.

**Live app:** https://generate.tattoosuggest.com

---

## What It Does

Tattoo Suggest lets users design a tattoo by selecting placement, style, subject, shading technique, and secondary elements — then generates a photorealistic studio-quality mockup using the Gemini 2.5 Flash image generation API. A one-click stencil export converts the mockup into line art ready for the tattooing chair.

## Features

- **AI Tattoo Generation** — Photorealistic images via Gemini 2.5 Flash, driven by structured prompts built from user selections
- **Stencil Extraction** — Converts generated tattoos into black-and-white stencil line art for printing
- **Credit System** — New users receive 250 free credits; each generation costs 50 credits
- **Credit Purchases** — Buy 1,500 credits for $49.99 via Stripe Checkout
- **Generation History** — All generations saved to Firestore and tied to the user's account
- **Google Login** — Firebase Authentication with Google OAuth

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS + CSS (glassmorphism, dark mode) |
| Auth | Firebase Authentication (Google OAuth) |
| Database | Firebase Firestore |
| Storage | Firebase Cloud Storage |
| Hosting | Firebase Hosting |
| Backend API | Node.js + Express on Render.com |
| AI | Gemini 2.5 Flash (image generation) |
| Payments | Stripe Checkout + Webhooks |
| CI/CD | GitHub Actions → Firebase deploy on push to `master` |

## Tattoo Options

Users build their prompt from five categories:

1. **Placement** — Forearm, upper arm, torso, leg, hand/foot, neck
2. **Style** — Blackwork, realism, illustrative, geometric, watercolor, Japanese, tribal, script
3. **Primary Subject** — Flora/fauna, symbolic objects, figures, mythology, pop culture, celestial
4. **Secondary Elements** — Integrated text, geometric frames, nature fillers, background effects
5. **Shading Technique** — Stippling, smooth grey-wash, high contrast, cross-hatching, whip shading, fine-line

## Repository Structure

```
├── frontend/           # Static frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── script.js
│   └── style.css
├── backend/            # Express API (deployed to Render.com)
│   └── server.js
├── docs/               # Architecture, API reference, deployment guide
├── firestore.rules     # Firestore security rules
├── storage.rules       # Cloud Storage security rules
├── firebase.json       # Firebase Hosting config
└── .github/workflows/  # GitHub Actions CI/CD
```

## Backend API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/config` | Returns Firebase config |
| `POST` | `/api/generate` | Generate tattoo (validates token, checks credits, calls Gemini) |
| `POST` | `/api/stencil` | Extract stencil from tattoo image |
| `POST` | `/api/create-checkout-session` | Create Stripe checkout session |
| `POST` | `/api/stripe-webhook` | Auto-credit user on successful payment |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
