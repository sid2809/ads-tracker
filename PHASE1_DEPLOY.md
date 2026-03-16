# Phase 1 — Deployment Guide

## What's in this drop

### New files (copy into repo):
```
src/middleware.js              ← Auth middleware
src/lib/db.js                 ← Postgres connection pool
src/lib/db-schema.js          ← Auto-migration (4 tables)
src/lib/auth.js               ← Cookie sign/verify, credential check
src/lib/api-auth.js           ← API route auth helpers (getUser, requireAdmin)
src/app/layout.js             ← REPLACES existing (adds AuthProvider)
src/app/globals.css            ← REPLACES existing (Resend design tokens)
src/app/page.js                ← REPLACES existing (dashboard with pinned cards)
src/app/login/page.js          ← NEW
src/app/reconciliation/page.js ← NEW (moved from old page.js)
src/app/domain-search/page.js  ← REPLACES existing (no accounts pre-selected)
src/app/domains/[id]/page.js   ← NEW (domain hub placeholder)
src/app/domains/[id]/settings/page.js ← NEW
src/app/api/auth/login/route.js    ← NEW
src/app/api/auth/logout/route.js   ← NEW
src/app/api/auth/me/route.js       ← NEW
src/app/api/domains/route.js       ← NEW (GET all + POST create)
src/app/api/domains/[id]/route.js  ← NEW (GET + PUT + DELETE)
src/app/api/domains/[id]/sheets/route.js         ← NEW
src/app/api/domains/[id]/sheets/[sheetId]/route.js ← NEW
src/app/api/domains/[id]/stats/route.js          ← NEW
src/app/api/domains/[id]/cache/route.js          ← NEW
src/components/NavBar.js       ← REPLACES existing
src/components/index.js        ← REPLACES existing (barrel with new exports)
src/components/AuthProvider.js ← NEW
src/components/ThemeToggle.js  ← NEW
src/components/AddDomainModal.js    ← NEW
src/components/DeleteDomainModal.js ← NEW
src/components/DomainCard.js   ← NEW
src/components/Sparkline.js    ← NEW
```

### Config files (REPLACE existing):
```
Dockerfile        ← Optimized multi-stage
package.json      ← Added pg dependency
tailwind.config.js ← Added darkMode: 'class'
globals.css       ← Complete rewrite with design tokens
```

### Files that STAY UNTOUCHED in repo:
```
src/lib/google-ads.js
src/lib/google-sheets.js
src/lib/csv.js
src/lib/utils.js
src/app/api/accounts/route.js
src/app/api/reconcile/route.js
src/app/api/domain-search/route.js
src/components/StatCard.js
src/components/TabButton.js
src/components/ConfigPanel.js
src/components/AccountSelector.js
src/components/DataTable.js
src/components/MissingTab.js
src/components/ActiveTab.js
src/components/ExtraTab.js
```

---

## Step-by-step deployment

### 1. Set env vars in Railway (precious-surprise project)

Go to your ads-tracker service → Variables → add these 4:

```
ADMIN_USERNAME=siddharth
ADMIN_PASSWORD=<pick a strong password>
VIEWER_ACCOUNTS=[]
AUTH_SECRET=<run: openssl rand -hex 32>
```

`DATABASE_URL` should already be set if Postgres is linked. Verify it exists.

### 2. Copy files into repo

Unzip the drop. Copy all files into your `ads-tracker` repo, replacing existing files where noted above.

### 3. Generate package-lock.json

```bash
cd ads-tracker
npm install
```

This generates `package-lock.json` (required for `npm ci` in Dockerfile).

### 4. Commit and push

```bash
git add -A
git commit -m "feat: Phase 1 — auth, database, domain CRUD, dashboard rewrite"
git push origin main
```

Railway auto-deploys on push to main.

### 5. Verify

1. **Open** https://tracker.gostaging.site → should redirect to `/login`
2. **Login** with your ADMIN_USERNAME / ADMIN_PASSWORD → should land on dashboard
3. **Dashboard** should show empty state: "No pinned domains yet"
4. **Click** Domains dropdown in navbar → "+ Add Domain" → type a domain name → Create
5. **Settings** page opens → configure accounts, source sheet → Save
6. **Back to dashboard** → pin the domain from the dropdown
7. **Dashboard** shows the pinned card (placeholder stats for now — Phase 3 fills in real data)
8. **Dark/light toggle** works (sun/moon icon in navbar)
9. **/reconciliation** works as before (no accounts pre-selected)
10. **/domain-search** works as before (no accounts pre-selected)

### 6. Test viewer access

Add a viewer in Railway env vars:
```
VIEWER_ACCOUNTS=[{"username":"viewer1","password":"test123"}]
```

Redeploy. Login as viewer1 → should see dashboard, domain cards, but no edit buttons, no add domain, no run buttons.

---

## What Phase 2 will add
- Wire reconciliation + search tabs inside domain hub (/domains/[id])
- Pre-fill from saved settings, override detection, SaveCachePrompt
- Cache reads on domain hub page load
