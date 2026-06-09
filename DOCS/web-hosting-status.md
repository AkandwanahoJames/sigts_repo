# SIGTS web hosting status

**Updated:** 2026-06-08

## Live URLs

| Service | URL | Status |
|---------|-----|--------|
| **App (production)** | https://sigts.vercel.app | Live — static PWA + API on Vercel |
| **Vercel project** | `sigts-static` | Linked in `.vercel/project.json` |
| **API health** | https://sigts.vercel.app/api/health | Responds (`degraded` until DB URL is fixed) |
| **Render (legacy)** | https://sigts-repo.onrender.com/api | Unreachable — replaced by Vercel API |

## Architecture (current)

```text
Browser → https://sigts.vercel.app (Vercel)
            ├── static PWA (frontend/public)
            └── /api/* → serverless Express (api/index.js)
                    └── Supabase Postgres (transaction pooler, IPv4)
```

`API_URL` on Vercel: `https://sigts.vercel.app/api` (same origin).

## What was done (2026-05-27)

1. **Full-stack on Vercel** — `vercel.json` builds the PWA and deploys `api/index.js` (no Render dependency).
2. **Serverless fixes** — `uuid` → `crypto.randomUUID()`; multer uses memory storage on Vercel; skip runtime-config write on serverless.
3. **Supabase IPv4** — `pgPoolConfig.js` rewrites direct `db.*.supabase.co:5432` URLs to pooler when `VERCEL` is set.
4. **Env on Vercel (production)** — `API_URL`, `CLIENT_URL`, `PUBLIC_APP_URL`, `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`.

## Blocker — database connection (registration + live login)

**Symptom:** `/api/health` shows `"database":{"status":"error"}`; new account registration fails (504/503). Demo quick-login buttons may still open the UI, but **live** register/login need the database.

**Cause (2026-06-08):** Supabase project ref `hjculkldwjrsifvnaugy` no longer resolves in DNS (`*.supabase.co` / `db.*.supabase.co`). The stored pooler password/URI is stale or the project was deleted/paused.

### Fix (required once)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → **create a new project** (or open the active one).
2. **Project Settings → Database → Connect** → copy **Transaction pooler** URI (port **6543**).
3. Save in `backend/.env.supabase` as `DATABASE_URL_POOLER` (and set `SUPABASE_PROJECT_REF` + `DATABASE_PASSWORD` if using the template).
4. Run the automated repair (tests DB, updates Vercel, migrates, deploys):

```powershell
cd c:\Projects\SIGTS
.\scripts\setup-production-db.ps1
```

5. Confirm: `https://sigts.vercel.app/api/health` → `"status":"healthy"` and `"database":{"status":"connected"}`.
6. Register a new test user on the hosted app and sign in.

## Redeploy frontend + API (CLI)

```powershell
cd c:\Projects\SIGTS
vercel deploy --prod --yes
vercel alias sigts-static.vercel.app sigts.vercel.app
```

## Smoke test

1. https://sigts.vercel.app — login screen loads (no 500)
2. https://sigts.vercel.app/api/health — healthy + database connected
3. Browser console: `window.__SIGTS_API_BASE__` → `https://sigts.vercel.app/api`
