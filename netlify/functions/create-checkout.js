// netlify/functions/create-checkout.js
// Creates a Stripe Checkout session with the exact calculated price.
// Required Netlify env var: STRIPE_SECRET_KEY

exports.handler = async function(event) {
    const CORS = {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
    if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured in Netlify environment variables' }),
        };
    }

    try {
        const { wordCount, reviewFee, authorEmail, manuscriptTitle } = JSON.parse(event.body);

        if (!reviewFee || reviewFee < 50) {
            return {
                statusCode: 400,
                headers: CORS,
                body: JSON.stringify({ error: 'Invalid review fee' }),
            };
        }

        // Build a readable description of the fee breakdown
        let description = `Manuscript review — ${wordCount.toLocaleString()} words`;
        if (wordCount > 2500) description += ' · Tier 1 + Tier 2';
        if (wordCount > 3500) description += ' + Tier 3';

        // Stripe expects amount in cents
        const amountCents = reviewFee * 100;

        const origin = event.headers.origin || event.headers.referer?.split('/').slice(0,3).join('/') || 'https://researchjunction.netlify.app';

        // Create Stripe Checkout session via REST API (no SDK needed)
        const params = new URLSearchParams({
            'payment_method_types[]':              'card',
            'line_items[0][price_data][currency]': 'usd',
            'line_items[0][price_data][unit_amount]': amountCents,
            'line_items[0][price_data][product_data][name]': 'Manuscript Review — Research Junction',
            'line_items[0][price_data][product_data][description]': description,
            'line_items[0][quantity]':             '1',
            'mode':                                'payment',
            'success_url':                         `${origin}/manuscript.html?payment=success`,
            'cancel_url':                          `${origin}/manuscript.html?payment=cancelled`,
            'customer_email':                      authorEmail || '',
            'metadata[manuscript_title]':          manuscriptTitle || '',
            'metadata[word_count]':                wordCount?.toString() || '',
            'metadata[review_fee]':                reviewFee?.toString() || '',
        });

        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Content-Type':  'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const session = await stripeResponse.json();

        if (!stripeResponse.ok) {
            return {
                statusCode: stripeResponse.status,
                headers: CORS,
                body: JSON.stringify({ error: session.error?.message || 'Stripe error' }),
            };
        }

        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ url: session.url }),
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
