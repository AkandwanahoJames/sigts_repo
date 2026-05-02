# SIGTS Requirements Implementation Alignment

This file summarizes how the repository supports the **Smart Information Guide Tour System (SIGTS)** requirements and points to detailed coverage.

## Authoritative checklist

See **[functional-requirements-tracker.md](./functional-requirements-tracker.md)** for the full **§3.1** module-by-module table (authentication through feedback). That tracker lists each named functional component as **implemented**, **partial**, or **missing**, with pointers to backend routes and frontend areas.

## High-level posture

- **Core park experience** (browse animals/locations/culture, map, sightings, offline caches, JWT auth with refresh rotation, PostGIS geofence, feedback including NPS) is present but not every sub-bullet of the specification is completed.
- **IT manager tooling** (`/api/admin/*`, `/api/analytics/*`, cultural verify/publish) exists in varying depth; analytics and reporting skew toward APIs that need richer UI consumption.
- **Gaps calling for product decisions** include: SMS MFA, unified global search, DEM-backed elevation, SQLite-first mobile client (vs browser storage), ranger dispatch integrations, guided voice navigation, automated backups/report scheduling inside the app, and ML training pipelines.

## Non-functional hardening

Inspect `backend/src/config/requirements.js` for production guards (JWT secret, limits, rate limits, CORS). Keep those aligned with deployment policy.

## Maintenance

After meaningful feature work, update **functional-requirements-tracker.md** so it stays aligned with §3.1 wording from the specification document.
