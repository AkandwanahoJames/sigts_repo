# SIGTS system debug status

Last full check: automated `debug:all` with backend on port **8001**, `NODE_ENV=development`.

## Results

| Check | Status |
|-------|--------|
| PostgreSQL + migrations (through 015) | OK |
| API health | OK |
| Tourist / guide / IT login | OK |
| Admin directory + operational snapshot | OK |
| All 12 functional requirement areas | **23/23 pass** |

## Fixes applied in this session

1. **Rate limiting (429 errors)** — Development disables the general API cap; production uses 3000/15min with skips for health, auth, presence, refresh, and public catalogue GETs.
2. **Demo passwords** — `test_tourist`, `demo_guide`, `demo_it`, `demo_admin` → `Test123!`
3. **Backend restart** — Required after code changes (port 8001 must run the updated `apiRateLimit.js`).

## Commands

```bash
cd backend
$env:PORT='8001'
$env:NODE_ENV='development'
npm start

# Another terminal:
npm run debug:all
npm run prepare:panel   # optional: seed tours, intranet, sightings
```

## Remaining warnings (not runtime failures)

- **JWT_SECRET** weak in development — set a strong `JWT_SECRET` in production.
- **Cultural narrative seed** may skip on some schema variants (non-fatal).
- **Offline sync** only implements sightings create server-side (by design).

## Frontend

Hard-refresh after pulls (`index.html` cache-bust query strings on `app-data.js`, `app-managers.js`, `app-views.js`).
