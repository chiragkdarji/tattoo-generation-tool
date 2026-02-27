const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // node-fetch v2 for commonjs
const { Jimp } = require('jimp'); // For image processing stencil generation
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
// Initialize Firebase Admin (Required for secure backend credit updates!)
// WARNING: Locally this requires serviceAccountKey.json.
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin initialized via Environment Variable JSON.");
    } else if (process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID
        });
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

// Middleware
app.use(cors());

// Root Health Check
app.get('/', (req, res) => {
    res.send('Tattoo Tool API is active and running safely! (Backend)');
});

// STRIPE WEBHOOK (Must be raw before express.json parsing)
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;
    try {
        const sig = req.headers['stripe-signature'];
        // Use a dummy secret locally since Stripe CLI isnt running. 
        // In prod this comes from process.env.STRIPE_WEBHOOK_SECRET
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
    } catch (err) {
        // Fallback for local testing without Signature Verification
        try {
            event = JSON.parse(req.body.toString());
        } catch (e) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id;
        console.log(`Payment confirmed for user: ${userId}, adding 1500 credits!`);

        // Securely add credits bypassing client rules
        try {
            if (admin.apps.length > 0) {
                const db = admin.firestore();
                const userRef = db.collection('users').doc(userId);
                await userRef.update({
                    credits: admin.firestore.FieldValue.increment(1500)
                });
                console.log("Stripe Webhook successfully funded User:", userId);
            } else {
                console.log("⚠️ Firebase Admin not connected! Credits must be added manually or you must provide serviceAccountKey.json.");
            }
        } catch (e) {
            console.error("Failed to update credits via Admin API", e);
        }
    }

    res.json({ received: true });
});

app.use(express.json({ limit: '50mb' })); // Increase limit to handle base64 images

// STRIPE CHECKOUT ROUTE
app.post('/api/create-checkout-session', async (req, res) => {
    const { userId } = req.body;
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product: 'prod_U3QbCEpQGLaFvr', // The product you created on Stripe
                        unit_amount: 4999, // $49.99 in total cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/?payment=success`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/?payment=canceled`,
            client_reference_id: userId // CRITICAL: Links the payment instance securely to the user ID!
        });

        res.json({ id: session.id, url: session.url });
    } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).json({ error: "Failed to create checkout session" });
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

// Main Generate Route (Proxying to Nano Banana)
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, aspect_ratio, userId } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required." });
        }

        // --- BACKEND CREDIT SECURITY ---
        if (!userId) {
            return res.status(401).json({ error: "User authentication required for credits." });
        }

        try {
            if (admin.apps.length > 0) {
                const db = admin.firestore();
                const userRef = db.collection('users').doc(userId);
                const userSnap = await userRef.get();

                if (!userSnap.exists) {
                    return res.status(404).json({ error: "User wallet not found." });
                }

                const userData = userSnap.data();
                if ((userData.credits || 0) < 50) {
                    return res.status(403).json({ error: "Insufficient credits. You need 50 credits per generation." });
                }

                // Deduct 50 credits securely
                await userRef.update({
                    credits: admin.firestore.FieldValue.increment(-50)
                });
                console.log(`Deducted 50 credits from User ${userId}. Remaining will be approx ${userData.credits - 50}`);
            } else {
                console.warn("Firebase Admin not active - skipping backend credit deduction (Debug Mode)");
            }
        } catch (e) {
            console.error("Credit deduction failed:", e);
            return res.status(500).json({
                error: "Database error during credit verification.",
                details: e.message
            });
        }
        // -------------------------------

        console.log(`Sending Prompt to Nano Banana 2.5: ${prompt}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000); // 35 second timeout

        // Construct Request to AI API 
        // Using the Gemini API endpoint
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.NANO_BANANA_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
                "contents": [
                    {
                        "parts": [
                            { "text": prompt }
                        ]
                    }
                ],
                "generationConfig": {
                    "responseModalities": ["IMAGE"],
                    ...(aspect_ratio ? {
                        "imageConfig": {
                            "aspectRatio": aspect_ratio
                        }
                    } : {})
                }
            })
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const err = await response.text();
            console.error("Gemini API Error:", err);
            return res.status(response.status).json({ error: `AI API Error: ${response.statusText}`, details: err });
        }

        const data = await response.json();

        // Extract base64 image data from the Gemini response structure
        const base64Data = data.candidates[0].content.parts[0].inlineData.data;
        const buffer = Buffer.from(base64Data, 'base64');

        // Return the binary image straight to the frontend
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);

    } catch (error) {
        console.error("Backend Server Error in /api/generate:", error.message);
        if (error.name === 'AbortError') {
            res.status(504).json({ error: "The AI API request timed out. The server is currently under heavy load (Google Gemini limit). Please try again in a few seconds." });
        } else if (error.code === 'ECONNRESET') {
            res.status(502).json({ error: "The connection to the AI generation service was unexpectedly reset by Google. Please click generate again." });
        } else {
            res.status(500).json({ error: "Internal Server Error. Check backend logs.", details: error.message });
        }
    }
});

// Stencil Generation Route
app.post('/api/stencil', async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: "Image data is required." });
        }

        // Clean up base64 string if it includes the data URI prefix
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        // Ask the Google Gemini Image model to completely flatten and convert the photo into a geometric stencil
        const aiPrompt = "Analyze the shape, lines, and design of the tattoo in this image. Completely extract and 'un-wrap' ONLY the tattoo design from the human skin, converting it into a perfectly flat, front-facing, strictly 2-dimensional geometric vector-style stencil. The output must be pure black ink lines against a pure white background, completely removing all 3D curves, human flesh, and photo perspective.";

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.NANO_BANANA_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                "contents": [
                    {
                        "parts": [
                            { "text": aiPrompt },
                            {
                                "inlineData": {
                                    "mimeType": "image/png",
                                    "data": base64Data
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": { "responseModalities": ["IMAGE"] }
            })
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini Stencil Error:", errorText);
            return res.status(response.status).json({ error: "Failed to generate AI stencil", details: errorText });
        }

        const data = await response.json();
        const outputBase64 = data.candidates[0].content.parts[0].inlineData.data;
        const outputBuffer = Buffer.from(outputBase64, 'base64');

        res.setHeader('Content-Type', 'image/png');
        res.send(outputBuffer);

    } catch (error) {
        console.error("Stencil Generation Error:", error.message);
        if (error.name === 'AbortError') {
            res.status(504).json({ error: "The AI API request timed out while unwrapping the tattoo. Please try again." });
        } else if (error.code === 'ECONNRESET') {
            res.status(502).json({ error: "The connection to the Google Stencil service was interrupted. Please click download stencil again." });
        } else {
            res.status(500).json({ error: "Failed to generate stencil.", details: error.message });
        }
    }
});

// Image Proxy Route to Bypass Firebase Storage CORS
app.get('/api/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ error: "Missing url parameter" });
        }

        const response = await fetch(imageUrl);
        if (!response.ok) {
            return res.status(response.status).json({ error: "Failed to fetch remote image" });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
        res.send(buffer);
    } catch (error) {
        console.error("Image Proxy Error:", error.message);
        res.status(500).json({ error: "Failed to proxy image." });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Backend securely running on port ${PORT}`);
});
