// netlify/functions/scholar-stats.js
//
// Strategy (in order of preference):
//
//  1. Firebase cache  — if stats were fetched < 24h ago, return them instantly.
//                       Zero latency, zero Scholar requests.
//
//  2. SerpApi         — free tier (100 searches/mo). Set SERPAPI_KEY in
//                       Netlify environment variables to enable this.
//                       Reliable, never 403s, returns structured JSON.
//
//  3. Direct scrape   — last resort, often 403'd by Google on datacenter IPs.
//                       Works occasionally, useful as a final fallback attempt.
//
//  4. Hardcoded       — if everything fails, return last-known real values so
//                       the page always shows something, never dashes.

const SCHOLAR_ID = 'XT483uIAAAAJ';

// ── Last-known values — update these manually after checking your profile ──────
// Fill these in now so the page never shows dashes even if all fetches fail.
const HARDCODED_FALLBACK = {
    citations: null,  // e.g. 73  ← put your real current number here
    hIndex:    null,  // e.g. 5
    i10Index:  null,  // e.g. 3
    source:    'hardcoded-fallback',
};

// ── Firebase config (same project your site already uses) ─────────────────────
const FIREBASE_DB_URL = 'https://insight-3bbec-default-rtdb.firebaseio.com';
const CACHE_TTL_MS    = 24 * 60 * 60 * 1000; // 24 hours

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
};

function ok(data) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

// ── Firebase REST helpers (no SDK needed in a serverless function) ─────────────
async function firebaseGet(path) {
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

async function firebaseSet(path, data) {
    try {
        await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(data),
        });
    } catch (e) { console.warn('Firebase write failed:', e.message); }
}

// ── SerpApi fetch ──────────────────────────────────────────────────────────────
// Sign up at serpapi.com — free tier gives 100 searches/month (plenty for this).
// Add SERPAPI_KEY to Netlify: Site settings → Environment variables.
async function fetchViaSerpApi(apiKey) {
    const url = `https://serpapi.com/search.json?engine=google_scholar_author&author_id=${SCHOLAR_ID}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SerpApi ${res.status}`);
    const data = await res.json();

    const table    = data?.cited_by?.table ?? [];
    const citations = table[0]?.citations?.all ?? null;
    const hIndex    = table[1]?.h_index?.all   ?? null;
    const i10Index  = table[2]?.i10_index?.all ?? null;

    if (citations === null) throw new Error('SerpApi: unexpected response shape');
    return { citations, hIndex, i10Index, source: 'serpapi' };
}

// ── Direct scrape (last resort — Google 403s datacenter IPs frequently) ────────
async function fetchDirectScrape() {
    const url = `https://scholar.google.com/citations?user=${SCHOLAR_ID}&hl=en`;
    const res = await fetch(url, {
        headers: {
            'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection':      'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        },
    });
    if (!res.ok) throw new Error(`Scholar direct scrape: ${res.status}`);

    const html  = await res.text();
    // Stats table cells appear in order: citations-all, citations-recent, h-all, h-recent, i10-all, i10-recent
    const cells = [...html.matchAll(/<td[^>]*class="gsc_rsb_std"[^>]*>(\d+)<\/td>/g)];
    if (cells.length < 5) throw new Error('Could not parse Scholar stats table');

    return {
        citations: parseInt(cells[0][1], 10),
        hIndex:    parseInt(cells[2][1], 10),
        i10Index:  parseInt(cells[4][1], 10),
        source:    'direct-scrape',
    };
}

// ── Main handler ───────────────────────────────────────────────────────────────
exports.handler = async function() {
    // 1 ── Firebase cache (fastest, no Scholar request at all)
    const cached = await firebaseGet('scholar_cache');
    if (cached?.fetchedAt) {
        const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
        if (ageMs < CACHE_TTL_MS && cached.citations != null) {
            console.log(`Cache hit — ${Math.round(ageMs / 60000)}m old`);
            return ok({ ...cached, fromCache: true });
        }
    }

    // 2 ── SerpApi (reliable, requires free API key in env vars)
    const serpKey = process.env.SERPAPI_KEY;
    if (serpKey) {
        try {
            const stats   = await fetchViaSerpApi(serpKey);
            const payload = { ...stats, fetchedAt: new Date().toISOString() };
            await firebaseSet('scholar_cache', payload);
            return ok(payload);
        } catch (e) { console.warn('SerpApi failed:', e.message); }
    }

    // 3 ── Direct scrape (often blocked, worth trying)
    try {
        const stats   = await fetchDirectScrape();
        const payload = { ...stats, fetchedAt: new Date().toISOString() };
        await firebaseSet('scholar_cache', payload);
        return ok(payload);
    } catch (e) { console.warn('Direct scrape failed:', e.message); }

    // 4 ── Hardcoded fallback — always returns real numbers if you fill them in above
    return ok({
        ...HARDCODED_FALLBACK,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
    });
};
