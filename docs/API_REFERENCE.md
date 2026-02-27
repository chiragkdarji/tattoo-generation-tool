# API Reference

The backend provides several key endpoints.

### 1. `GET /api/config`
Fetches the public Firebase configuration keys from the backend environment variables. This prevents hardcoding secrets in the frontend source.

### 2. `POST /api/generate`
**Payload**: `{ prompt, aspect_ratio, userId }`
- Verifies user has 50+ credits.
- Deducts 50 credits from Firestore.
- Calls Gemini AI.
- Returns the generated image.

### 3. `POST /api/stencil`
**Payload**: `{ imageBase64 }`
- Processes a tattoo image through an OpenCV-based filter.
- Returns a transparent PNG stencil.

### 4. `POST /api/create-checkout-session`
**Payload**: `{ userId }`
- Initializes a Stripe Checkout session.
- Binds the unique `userId` to the transaction.
- Returns the Stripe payment URL.

### 5. `POST /api/stripe-webhook`
**Role**: Listens for Stripe events.
- Validates Stripe signatures.
- On `checkout.session.completed`, increments the user's credits by 1500 using Firebase Admin.
