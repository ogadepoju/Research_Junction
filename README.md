# Research Junction — Netlify Deployment

## File Structure

```
researchjunction/
├── index.html          → Homepage (researchjunction.org)
├── pulse.html          → The Pulse / Insights newsroom
├── manuscript.html     → The Accelerator / manuscript review
├── academy.html        → The Academy teaching track
├── community.html      → The Community research lab
├── shared.js           → Firebase init (shared by index + pulse homepage cards)
├── netlify.toml        → URL redirects + security headers
└── README.md           → This file
```

## Deploy to Netlify

### Option A — Drag & Drop (fastest)
1. Go to https://app.netlify.com/drop
2. Drag the entire `researchjunction/` folder into the drop zone
3. Done — Netlify gives you a live URL instantly

### Option B — Git Deploy (recommended for ongoing use)
1. Push this folder to a GitHub repo
2. In Netlify: **Add new site → Import an existing project**
3. Connect your repo — no build command needed, publish directory = `/`

## URL Redirects (configured in netlify.toml)

| Netlify URL | Serves |
|---|---|
| `/` | `index.html` |
| `/insight` | `pulse.html` |
| `/manuscript` | `manuscript.html` |
| `/academic-track` | `academy.html` |
| `/the-community` | `community.html` |

## Scholar Stats Setup (community page)

The community page shows live citation count, h-index, and i10-index.

### Quickest fix — seed the cache manually (takes 30 seconds)
1. Open `scholar-seed.html` in your browser (double-click it locally, or deploy first and visit it)
2. Copy your current numbers from your [Google Scholar profile](https://scholar.google.com/citations?user=XT483uIAAAAJ&hl=en)
3. Click "Save to Firebase Cache"
4. The community page now shows your real stats for 24 hours
5. **Delete `scholar-seed.html` after use** — it's a local tool, not for public deployment

### Long-term fix — SerpApi (free, 100 requests/month)
1. Sign up at [serpapi.com](https://serpapi.com) — free tier is enough
2. Get your API key
3. In Netlify: **Site settings → Environment variables → Add variable**
   - Key: `SERPAPI_KEY`
   - Value: your SerpApi key
4. Redeploy — the function will now auto-refresh stats daily via SerpApi

### How it works
The Netlify function (`netlify/functions/scholar-stats.js`) tries in order:
1. Firebase cache (< 24h old) — instant, no external request
2. SerpApi — reliable if key is set
3. Direct Google Scholar scrape — often blocked (403) on server IPs
4. Hardcoded fallback in the function file itself

To update hardcoded fallback values, edit `HARDCODED_FALLBACK` in `netlify/functions/scholar-stats.js`.

1. **Community Stripe link** — `community.html` line with `TODO` comment
   → Replace the placeholder with your actual $10/mo Stripe Payment Link

2. **Custom domain** — In Netlify: Site settings → Domain management → Add custom domain

3. **Firebase rules** — In Firebase Console, make sure your Realtime Database
   rules allow public reads for the pulse feed but restrict writes appropriately

## What was fixed from the original Google Sites version

- Removed Cloudflare email obfuscation scripts (won't work off Cloudflare)
- Fixed `href="https://https://..."` double-protocol bug on community card
- Fixed Firebase loading order on pulse.html (was calling window.db before init)
- Removed duplicate `init()` and duplicate utility functions on pulse.html
- All internal links now use relative paths (`/pulse.html`, `/#tracks`, etc.)
- Email addresses restored as plain `mailto:` links
- All `javascript:void(0)` nav links on inner pages replaced with proper hrefs
- XSS: added `escHtml()` and `escAttr()` around all Firebase-rendered content
- Removed dead `href="https://payment-link"` placeholder (now validated in JS)
- All `&` in HTML attributes properly escaped as `&amp;`
- Agreement modals now validate all checkboxes before redirecting

## Things to update before launch

1. **Community Stripe link** — `community.html` line with `TODO` comment
2. **Scholar stats** — run `scholar-seed.html` to seed your real numbers into Firebase cache
3. **Custom domain** — Netlify: Site settings → Domain management
4. **SerpApi key** — optional but recommended for auto-refresh (see above)
