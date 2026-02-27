const fetch = require('node-fetch');
require('dotenv').config();

async function testQuotaBody() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.NANO_BANANA_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "contents": [{ "parts": [{ "text": "A tiny dot" }] }],
                "generationConfig": { "responseModalities": ["IMAGE"] }
            })
        });

        const json = await response.json();
        // remove candidates to keep the log small
        if (json.candidates) {
            json.candidates = "[IMAGE DATA]";
        }
        console.log("JSON response structure:");
        console.log(JSON.stringify(json, null, 2));

    } catch (e) {
        console.error(e);
    }
}

testQuotaBody();
