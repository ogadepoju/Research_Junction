// netlify/functions/anthropic-proxy.js
// Required Netlify env var: GEMINI_API_KEY

const GEMINI_MODEL = 'gemini-2.5-flash';

exports.handler = async function(event) {
    const CORS = {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
    if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };

    try {
        const { prompt, systemPrompt } = JSON.parse(event.body);

        const geminiBody = {
            systemInstruction: {
                parts: [{ text: (systemPrompt || '') + '\nIMPORTANT: Respond with raw JSON only. No markdown, no code fences, no backticks. Start with { and end with }.' }]
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.7,
                // NOTE: responseMimeType cannot be used with googleSearch tool
            },
        };

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(geminiBody),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                headers: CORS,
                body: JSON.stringify({ error: data.error?.message || 'Gemini error' }),
            };
        }

        // Extract text
        let text = data.candidates?.[0]?.content?.parts
            ?.filter(p => p.text)
            ?.map(p => p.text)
            ?.join('') || '';

        // Strip markdown code fences if Gemini wraps anyway
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ text }) };

    } catch (err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
};
