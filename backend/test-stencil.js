const fetch = require('node-fetch');
require('dotenv').config();

async function testGeminiI2I() {
    console.log("Downloading test image...");
    try {
        const imageResponse = await fetch('https://images.unsplash.com/photo-1562962230-16e4623d36e6?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60');
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');

        console.log("Sending to Gemini as Image-to-Image request...");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.NANO_BANANA_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "contents": [
                    {
                        "parts": [
                            { "text": "Extract perfectly flat, geometric, 2D white background with pure black lines carbon stencil from this tattoo." },
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": base64Image
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": { "responseModalities": ["IMAGE"] }
            })
        });

        console.log("Status:", response.status);
        const json = await response.json();

        if (json.candidates && json.candidates[0].content.parts[0].inlineData) {
            console.log("SUCCESS! Got image back.");
            const outputBase64 = json.candidates[0].content.parts[0].inlineData.data;
            require('fs').writeFileSync('gemini-stencil-test.png', Buffer.from(outputBase64, 'base64'));
            console.log("Saved to gemini-stencil-test.png");
        } else {
            console.log("Error:", json);
        }

    } catch (e) {
        console.error(e);
    }
}

testGeminiI2I();
