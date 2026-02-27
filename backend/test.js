const fetch = require('node-fetch');
require('dotenv').config();

async function test() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.NANO_BANANA_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "contents": [{ "parts": [{ "text": "A tattoo of a butterfly on an arm" }] }],
                "generationConfig": {
                    "responseModalities": ["IMAGE"]
                },
                "parameters": {
                    "aspectRatio": "3:4"
                }
            })
        });

        console.log("Status1:", response.status);
        let text = await response.text();
        console.log("Response text1:", text.substring(0, 300));
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
