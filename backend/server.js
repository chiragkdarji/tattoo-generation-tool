const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // node-fetch v2 for commonjs
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// --- Constants ---
const CREDITS_PER_GENERATION = 50;
const CREDITS_FOR_PAYMENT = 1500;
const CREDIT_PACKAGE_PRICE_CENTS = 4999;
const STRIPE_PRODUCT_ID = 'prod_U3QbCEpQGLaFvr';
const API_TIMEOUT_MS = 35000;
const PROXY_TIMEOUT_MS = 10000;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const PROXY_ALLOWED_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];

// Initialize Firebase Admin
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("Firebase Admin initialized via Environment Variable JSON.");
    } else if (process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
        console.log("Firebase Admin initialized for project ID:", process.env.FIREBASE_PROJECT_ID);
    } else {
        admin.initializeApp();
    }
} catch (e) {
    if (e.code === 'app/duplicate-app') {
        console.log("Firebase Admin already initialized.");
    } else {
        console.error("Firebase Admin Init Error:", e.message);
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// --- Helpers ---

function sendError(res, status, code, message, details) {
    const body = { error: message, code };
    if (details) body.details = details;
    return res.status(status).json(body);
}

async function callGeminiAPI(requestBody) {
    const geminiUrl = `${GEMINI_BASE_URL}?key=${process.env.NANO_BANANA_API_KEY}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(requestBody)
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            const err = new Error(`AI API Error: ${response.statusText}`);
            err.statusCode = response.status;
            err.details = errorText;
            throw err;
        }

        return await response.json();
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function verifyIdToken(idToken, expectedUid) {
    if (!idToken) {
        const err = new Error("ID token is required.");
        err.statusCode = 401;
        err.code = 'MISSING_TOKEN';
        throw err;
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.uid !== expectedUid) {
        const err = new Error("Token does not match the provided user ID.");
        err.statusCode = 403;
        err.code = 'TOKEN_MISMATCH';
        throw err;
    }
}

// --- Routes ---

// Root Health Check
app.get('/', (req, res) => {
    res.send('Tattoo Tool API is active and running safely! (Backend)');
});

// STRIPE WEBHOOK (Must be raw before express.json parsing)
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const isDev = process.env.NODE_ENV === 'development' && process.env.ALLOW_UNSIGNED_WEBHOOKS === 'true';
    let event;

    if (webhookSecret) {
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            console.error("Webhook signature verification failed:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else if (isDev) {
        // Development-only fallback: allows testing without Stripe CLI
        try {
            event = JSON.parse(req.body.toString());
            console.warn("⚠️ Processing unsigned webhook in development mode.");
        } catch (e) {
            return res.status(400).send("Webhook Error: Failed to parse body.");
        }
    } else {
        console.error("Webhook rejected: STRIPE_WEBHOOK_SECRET is not configured.");
        return res.status(400).send("Webhook Error: Missing webhook secret configuration.");
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id;
        console.log(`Payment confirmed for user: ${userId}, adding ${CREDITS_FOR_PAYMENT} credits!`);

        try {
            if (admin.apps.length > 0) {
                const db = admin.firestore();
                const userRef = db.collection('users').doc(userId);
                await userRef.update({
                    credits: admin.firestore.FieldValue.increment(CREDITS_FOR_PAYMENT)
                });
                console.log("Stripe Webhook successfully funded User:", userId);
            } else {
                console.warn("⚠️ Firebase Admin not connected! Credits must be added manually.");
            }
        } catch (e) {
            console.error("Failed to update credits via Admin API", e);
        }
    }

    res.json({ received: true });
});

app.use(express.json({ limit: '10mb' }));

// STRIPE CHECKOUT ROUTE
app.post('/api/create-checkout-session', async (req, res) => {
    const { userId } = req.body;
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product: STRIPE_PRODUCT_ID,
                    unit_amount: CREDIT_PACKAGE_PRICE_CENTS,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/?payment=success`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/?payment=canceled`,
            client_reference_id: userId
        });

        res.json({ id: session.id, url: session.url });
    } catch (error) {
        console.error("Stripe Error:", error);
        return sendError(res, 500, 'STRIPE_ERROR', "Failed to create checkout session");
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        firebaseConfig: {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID
        }
    });
});

// Main Generate Route
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, aspect_ratio, userId, idToken } = req.body;

        if (!prompt) {
            return sendError(res, 400, 'MISSING_PROMPT', "Prompt is required.");
        }
        if (!userId) {
            return sendError(res, 401, 'MISSING_USER', "User authentication required.");
        }

        // Verify Firebase ID token
        if (admin.apps.length > 0) {
            try {
                await verifyIdToken(idToken, userId);
            } catch (e) {
                return sendError(res, e.statusCode || 401, e.code || 'AUTH_ERROR', e.message);
            }
        }

        // Verify and deduct credits atomically via Firestore transaction
        try {
            if (admin.apps.length > 0) {
                const db = admin.firestore();
                const userRef = db.collection('users').doc(userId);

                await db.runTransaction(async (transaction) => {
                    const userSnap = await transaction.get(userRef);
                    if (!userSnap.exists) {
                        const err = new Error("User wallet not found.");
                        err.statusCode = 404;
                        err.code = 'USER_NOT_FOUND';
                        throw err;
                    }
                    const credits = userSnap.data().credits || 0;
                    if (credits < CREDITS_PER_GENERATION) {
                        const err = new Error(`Insufficient credits. You need ${CREDITS_PER_GENERATION} credits per generation.`);
                        err.statusCode = 403;
                        err.code = 'INSUFFICIENT_CREDITS';
                        throw err;
                    }
                    transaction.update(userRef, {
                        credits: admin.firestore.FieldValue.increment(-CREDITS_PER_GENERATION)
                    });
                });

                console.log(`Deducted ${CREDITS_PER_GENERATION} credits from User ${userId}.`);
            } else {
                console.warn("Firebase Admin not active - skipping credit deduction (Debug Mode)");
            }
        } catch (e) {
            if (e.statusCode) return sendError(res, e.statusCode, e.code, e.message);
            console.error("Credit deduction failed:", e);
            return sendError(res, 500, 'DB_ERROR', "Database error during credit verification.", e.message);
        }

        console.log(`Sending Prompt to Gemini 2.5: ${prompt}`);

        let data;
        try {
            data = await callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                    ...(aspect_ratio ? { imageConfig: { aspectRatio: aspect_ratio } } : {})
                }
            });
        } catch (e) {
            if (e.statusCode) return sendError(res, e.statusCode, 'AI_API_ERROR', e.message, e.details);
            throw e;
        }

        const base64Data = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Data) {
            console.error("Unexpected Gemini response structure:", JSON.stringify(data));
            return sendError(res, 502, 'INVALID_AI_RESPONSE', "AI returned an unexpected response structure.");
        }

        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(base64Data, 'base64'));

    } catch (error) {
        console.error("Backend Server Error in /api/generate:", error.message);
        if (error.name === 'AbortError') {
            return sendError(res, 504, 'TIMEOUT', "The AI API request timed out. The server is under heavy load. Please try again in a few seconds.");
        } else if (error.code === 'ECONNRESET') {
            return sendError(res, 502, 'CONNECTION_RESET', "The connection to the AI generation service was reset. Please click generate again.");
        }
        return sendError(res, 500, 'INTERNAL_ERROR', "Internal Server Error. Check backend logs.", error.message);
    }
});

// Stencil Generation Route
app.post('/api/stencil', async (req, res) => {
    try {
        const { imageBase64, userId, idToken } = req.body;

        if (!imageBase64) {
            return sendError(res, 400, 'MISSING_IMAGE', "Image data is required.");
        }

        // Verify Firebase ID token when user context is provided
        if (userId && admin.apps.length > 0) {
            try {
                await verifyIdToken(idToken, userId);
            } catch (e) {
                return sendError(res, e.statusCode || 401, e.code || 'AUTH_ERROR', e.message);
            }
        }

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const aiPrompt = "Analyze the shape, lines, and design of the tattoo in this image. Completely extract and 'un-wrap' ONLY the tattoo design from the human skin, converting it into a perfectly flat, front-facing, strictly 2-dimensional geometric vector-style stencil. The output must be pure black ink lines against a pure white background, completely removing all 3D curves, human flesh, and photo perspective.";

        let data;
        try {
            data = await callGeminiAPI({
                contents: [{
                    parts: [
                        { text: aiPrompt },
                        { inlineData: { mimeType: "image/png", data: base64Data } }
                    ]
                }],
                generationConfig: { responseModalities: ["IMAGE"] }
            });
        } catch (e) {
            if (e.statusCode) return sendError(res, e.statusCode, 'AI_API_ERROR', e.message, e.details);
            throw e;
        }

        const outputBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!outputBase64) {
            console.error("Unexpected Gemini stencil response structure:", JSON.stringify(data));
            return sendError(res, 502, 'INVALID_AI_RESPONSE', "AI returned an unexpected response structure.");
        }

        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(outputBase64, 'base64'));

    } catch (error) {
        console.error("Stencil Generation Error:", error.message);
        if (error.name === 'AbortError') {
            return sendError(res, 504, 'TIMEOUT', "The AI API request timed out while unwrapping the tattoo. Please try again.");
        } else if (error.code === 'ECONNRESET') {
            return sendError(res, 502, 'CONNECTION_RESET', "The connection to the stencil service was interrupted. Please try again.");
        }
        return sendError(res, 500, 'INTERNAL_ERROR', "Failed to generate stencil.", error.message);
    }
});

// Image Proxy Route — SSRF-protected, only allows trusted Firebase Storage domains
app.get('/api/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return sendError(res, 400, 'MISSING_URL', "Missing url parameter");
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(imageUrl);
        } catch {
            return sendError(res, 400, 'INVALID_URL', "Invalid URL provided.");
        }

        if (!PROXY_ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
            return sendError(res, 403, 'DISALLOWED_HOST', "Proxying is not allowed for this domain.");
        }

        const response = await fetch(imageUrl, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
        if (!response.ok) {
            return sendError(res, response.status, 'FETCH_ERROR', "Failed to fetch remote image");
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
        res.send(buffer);
    } catch (error) {
        console.error("Image Proxy Error:", error.message);
        return sendError(res, 500, 'PROXY_ERROR', "Failed to proxy image.");
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Backend securely running on port ${PORT}`);
});
