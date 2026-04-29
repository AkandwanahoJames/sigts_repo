# SIGTS - Smart Information Guide Tour System

SIGTS is a web application for park operations and visitor guidance at Bwindi Impenetrable National Park.  
It combines tourism guidance, field tools, geofencing, offline support, AI-assisted recommendations, and internal staff workflows.

## What The App Includes

- Role-aware access for tourists, guides, and IT managers
- Authentication flows with password reset and MFA setup endpoints
- Dashboard with wildlife, map, culture, sightings, and AI chat sections
- Guide workflows (shift actions, tour lifecycle, quick sightings)
- IT and intranet workflows (announcements, inventory, employee status)
- Offline-first support with local caching and service worker integration

## Monorepo Layout

- `frontend/` - static web client (HTML/CSS/JS)
- `backend/` - Node.js API server
- `database/` - database artifacts
- `infra/` and `nginx/` - deployment/support files (`infra/nginx` is the canonical source)
- `DOCS/` - supporting documentation

## Local Development

### 1) Start backend

```bash
cd backend
npm install
npm run dev
```

Backend defaults to `http://localhost:8000`.

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend defaults to `http://localhost:3000`.

## Frontend API Configuration

The frontend API base resolves in this order:

1. `window.__SIGTS_API_BASE__` (if provided)
2. `http://localhost:8000/api` (when running on localhost)
3. `${window.location.origin}/api` (for deployed/proxied environments)

You can inject `window.__SIGTS_API_BASE__` before app scripts in `frontend/public/index.html` if needed.

## Recent UX/Behavior Improvements

- Restored app bootstrap globals required for startup
- Added URL hash route syncing and browser back/forward support
- Enabled service worker registration from app startup
- Replaced most native dialogs with in-app toast/modal feedback UI
- Improved button states, keyboard focus visibility, and small-screen spacing

## Notes

- This project currently contains demo-friendly behaviors and fallbacks for some flows.
- For production hardening, consider strict environment configuration, complete dialog unification, and expanded E2E coverage.
- For architecture/flow/ops walkthrough details, see `DOCS/repo-walkthrough.md`.
