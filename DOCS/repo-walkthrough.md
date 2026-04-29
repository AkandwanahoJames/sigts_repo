# SIGTS Repo Walkthrough

This document captures the implemented high-level walkthrough and the three deep-dive tracks:
- runtime flow mapping,
- auth consistency audit and fixes,
- ops/config consolidation guidance.

## 1) End-to-End Runtime Flows

### Login flow (frontend -> backend -> frontend)
1. Frontend bootstraps in `frontend/public/app.js` via `init()`.
2. Unauthenticated users are routed to `login` (or `register` if hash is `#register`).
3. `handleLogin()` in `frontend/public/js/app-views.js` calls `Auth.login()` in `frontend/public/js/app-managers.js`.
4. `Auth.login()` calls `API.request('/auth/login')` in `frontend/public/js/app-data.js`.
5. Backend validates credentials in `backend/src/routes/auth.js` (`POST /api/auth/login`), enforces optional geofence, and issues access/refresh tokens.
6. Frontend stores session token/user (local or session storage) and renders dashboard.

### Dashboard load flow
1. `navigateTo('dashboard')` triggers `renderView('dashboard')` in `frontend/public/js/app-views.js`.
2. `renderDashboardContent()` fetches recommendations/seasonal data from manager APIs.
3. `renderMainLayout()` applies role-aware sidebar and header widgets.
4. Background UI refresh handlers update network and rare-alert badges.

### Map data flow
1. `renderView('map')` injects `renderMapContent()` output and calls `initializeLiveMap()`.
2. `initializeLiveMap()` creates Leaflet map, loads tile layer, and starts periodic refresh.
3. Map data combines:
   - geofence boundary (`/api/geofence/boundary`),
   - POIs and locations (`/api/locations`),
   - sightings (`/api/sightings/recent`),
   - current geolocation from browser watcher.
4. UI controls (`mapLayer`, search, destination guidance, measure points) update map and map overlay text.

### Sightings submit flow
1. User action (`addSighting()` or guide quick flow) builds payload in `frontend/public/js/app-views.js`.
2. Payload is sent through `API.reportSighting()` in `frontend/public/js/app-data.js`.
3. Backend `POST /api/sightings` in `backend/src/routes/sightings.js` validates and inserts records.
4. Optional rare-alert artifacts are returned and reflected in badges/alerts.

## 2) Auth Consistency Audit + Applied Fixes

### Problems found
- Duplicate auth enforcement at both server route mounts and inside route modules.
- Separate token-generation/verification paths in `backend/src/server.js` vs shared auth config/middleware.

### Fixes applied
- Updated `backend/src/server.js` to use shared `generateToken()` for direct-login token issuance.
- Updated websocket auth in `backend/src/server.js` to use shared `verifyToken()` instead of ad-hoc `jwt.verify(...)`.
- Removed redundant mount-level `authenticateJWT` from route groups that already enforce auth in route files:
  - `/api/users`, `/api/animals`, `/api/locations`, `/api/cultural`, `/api/geofence`, `/api/admin`, `/api/analytics`, `/api/ai`, `/api/feedback`.
- Kept mount-level auth for routes that chain park geofence middleware at mount:
  - `/api/sightings`, `/api/tours`, `/api/sync`.

## 3) Ops/Runtime Consolidation Guidance

## Canonical locations
- **App proxy/runtime config:** `infra/nginx/` (treat as source of truth).
- **Database migrations/seeds:** `database/migrations/`, `database/seeds/`.
- **Node operational scripts:** `backend/scripts/` (migrate/init/healthcheck).
- **Windows DB operations:** `database/scripts/` (backup/restore/scheduling).

### Recommended team conventions
1. Use `infra/nginx` as the primary nginx config source and mirror into `nginx/` only when packaging legacy deploy artifacts.
2. Use one restore runbook that explicitly chooses either:
   - Node backup/restore flow (`backend/scripts`), or
   - PowerShell/Batch flow (`database/scripts`).
3. Require secrets only from environment variables in production; avoid fallback secrets in deployment envs.
4. Keep schema changes in migration files only, not request-path SQL mutations.

### Practical command set
- Backend migration status: `npm run migrate:status` (from `backend/`)
- Apply migrations: `npm run migrate:up`
- Seed baseline data: `npm run seed`
- Full DB reset/bootstrap: `npm run db:reset`
- Runtime health check: `npm run healthcheck`
