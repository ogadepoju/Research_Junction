# Scholar Stats — Automatic Daily Sync

Citations, h-index, and i10-index update automatically every day via GitHub Actions.
No third-party services. No manual updates. Fully free.

## One-time setup (5 minutes)

### Step 1 — Get your Firebase Database Secret

1. Go to [Firebase Console](https://console.firebase.google.com/project/insight-3bbec/settings/serviceaccounts/databasesecrets)
   **Project Settings → Service accounts → Database secrets**
2. Click **Show** next to the secret, copy it

### Step 2 — Add it to GitHub

1. Push your site to a GitHub repo (if not already)
2. Go to your repo → **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
   - Name:  `FIREBASE_SECRET`
   - Value: the secret you copied in Step 1
4. Click **Add secret**

### Step 3 — Fix Firebase Rules

In [Firebase Console → Realtime Database → Rules](https://console.firebase.google.com/project/insight-3bbec/database/insight-3bbec-default-rtdb/rules),
set your rules to this and click **Publish**:

```json
{
  "rules": {
    "pulse": {
      "posts":    { ".read": true,  ".write": false },
      "meta":     { ".read": true,  ".write": false },
      "usedUrls": { ".read": false, ".write": false }
    },
    "scholar_cache": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

The `"auth != null"` means only authenticated requests (using your database secret) can write — 
the public internet cannot.

### Step 4 — Run it once manually to test

1. Go to your GitHub repo → **Actions** tab
2. Click **Sync Scholar Stats** in the left sidebar
3. Click **Run workflow → Run workflow**
4. Watch the logs — should say `✓ Written to Firebase`
5. Reload your community page — your real numbers appear!

After that it runs automatically every day at 6am UTC. Done.

---

## How it works

```
GitHub Actions (daily 6am UTC)
  → fetches scholar.google.com/citations?user=XT483uIAAAAJ
  → parses citations / h-index / i10-index from the HTML
  → writes to Firebase: /scholar_cache
      → community.html reads from Firebase and displays live
```

GitHub's servers use varied IP ranges and a proper browser UA string,
which is far less likely to be 403'd than Netlify's known datacenter IPs.

## If the action ever fails

Check the Actions tab in GitHub for the error log. Common causes:
- Google temporarily blocking the IP → will usually succeed on next run
- Scholar HTML structure changed → open an issue or update the regex in the workflow

You can always fall back to scholar-seed.html to manually seed numbers
while you debug.
