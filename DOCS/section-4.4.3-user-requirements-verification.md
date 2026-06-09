# Section 4.4.3 User Requirements — Verification Matrix

**Source:** `FINAL PROJECT_backup_revised.docx` §4.4.3 (User Requirements)  
**Verified against:** SIGTS codebase + API (`backend/src/routes/*`, `frontend/public/js/*`)  
**Last updated:** 2026-06-09

**Status key**

| Status | Meaning |
|--------|---------|
| **Functional** | Live API/DB + working UI (not static placeholder) |
| **Partial** | Real backend or UI exists but limited scope, local-only, or heuristic |
| **Not met** | Missing or demo-only without persistence |

---

## Tourists (§4.4.3)

| # | Requirement | Status | Implementation evidence |
|---|-------------|--------|-------------------------|
| 1 | Register and log into the system | **Functional** | `POST /api/auth/register`, `POST /api/auth/login`; `AuthManager` + login/register screens |
| 2 | View animals, attractions, park facilities | **Functional** | `GET /api/animals`, `GET /api/locations/public`, culture/info views |
| 3 | Interactive maps and navigation | **Partial** | Leaflet map, POIs, routes; guidance is heuristic (not full turn-by-turn routing engine) |
| 4 | Location-based notifications and recommendations | **Partial** | Geofence proximity toasts, safe-zone alerts, dashboard AI recs; no native push/SMS |
| 5 | Search tourism information and nearby attractions | **Functional** | Home unified search + `GET /api/animals?search=`; locations/culture filtered client-side from API cache |
| 6 | Save and bookmark favorite content | **Partial** | `ContentManager` bookmarks in `localStorage`; Saved tab works; not synced per user on server |
| 7 | Weather updates and safety guidelines | **Functional** | `GET /api/weather` (Open-Meteo live + fallback); `GET /api/staying-safe-guide`, safety tips, FAQs from PostgreSQL |
| 8 | Multimedia (audio guides, videos) | **Functional** | Animal/location/culture detail modals render `audio_url` / `video_url` when present in DB |
| 9 | Submit wildlife sighting reports | **Functional** | `POST /api/sightings` + offline queue sync |
| 10 | Rate tours and provide feedback | **Functional** | Profile feedback → `POST /api/feedback` (NPS, surveys, bug reports) |
| 11 | Multilingual tourism information | **Partial** | Profile **Preferred language** (`language_pref` en/fr/local); culture uses `title_local`/`narrative_local` when set; full translation pipeline not complete for all entities |

---

## Tour guides (§4.4.3)

| # | Requirement | Status | Implementation evidence |
|---|-------------|--------|-------------------------|
| 1 | View assigned tour schedules | **Functional** | `GET /api/tours/schedule`, guide dashboard |
| 2 | Access guest information and tour details | **Functional** | `GET /api/tours/:id/guest-list`, preparation checklist |
| 3 | Track tourists during active tours | **Partial** | `GET /api/tours/:id/active-mode` guest GPS when tourists share location |
| 4 | Record wildlife sightings during tours | **Functional** | `quickSighting()` → `POST /api/sightings` with tour session |
| 5 | View and manage tour reports | **Partial** | Completion report view; no formal edit/approve workflow |
| 6 | Communicate with guides and park officials | **Partial** | Guide messaging `GET/POST /api/guides/messages`; emergency contacts list |
| 7 | Emergency communication services | **Functional** | `GET /api/tours/guide/emergency-contacts`; `tel:` links in guide dashboard |
| 8 | Provide tourism information to tourists | **Functional** | Guides use same wildlife/culture/map/AI views as tourists |
| 9 | Monitor tour progress and activities | **Functional** | Start/end tour, timer, active-mode panel, location sync |

---

## IT managers / administrators (§4.4.3)

| # | Requirement | Status | Implementation evidence |
|---|-------------|--------|-------------------------|
| 1 | Manage user accounts and permissions | **Partial** | Deactivate users in admin UI; `POST /admin/users` exists but no create/role UI |
| 2 | Manage system database and server | **Partial** | `GET /admin/system-health`, schema status via API; no DB admin console in SPA |
| 3 | Configure park boundaries and POIs | **Partial** | REST: `PUT /admin/parks/boundary`, location CRUD; no map editor in UI |
| 4 | Manage tourism content and multimedia | **Partial** | Bulk import API; uploads middleware; no full CMS UI |
| 5 | Approve cultural narratives and wildlife info | **Functional** | Admin dashboard **Content approval** panel → verify/publish cultural, approve/reject AI drafts |
| 6 | Monitor system performance and analytics | **Functional** | IT dashboard + Predictive Analytics workspace (`/api/analytics/*`) |
| 7 | Generate reports and system statistics | **Functional** | Report build/export/schedules in predictive analytics |
| 8 | Manage backups and system security | **Partial** | Backup create/list API + IT ops buttons; MFA setup; audit logs API without full UI |
| 9 | Respond to user feedback and technical issues | **Functional** | Admin dashboard **Visitor feedback queue** → `PUT /api/feedback/:id/respond` |

---

## Summary

| Role | Functional | Partial | Not met |
|------|------------|---------|---------|
| Tourist | 7 | 4 | 0 |
| Guide | 6 | 3 | 0 |
| IT manager | 4 | 5 | 0 |

**All §4.4.3 bullets have at least partial implementation; none are purely static placeholders.** Remaining gaps are intentional product boundaries (server-synced bookmarks, native push, turn-by-turn routing, full CMS/map admin UI) documented in [functional-requirements-tracker.md](./functional-requirements-tracker.md).

## Recent fixes (2026-06-09)

- Weather: Open-Meteo live feed for Bwindi with deterministic fallback (`publicParkContent.js`)
- Multilingual: `language_pref` on profile GET/PUT + UI language selector
- IT feedback response desk on Admin dashboard
- IT content approval panel (cultural verify/publish, AI approve/reject)
- Unified search uses server-side animal search API
- Cultural story modals show audio/video when URLs exist in DB

## Verification commands

```powershell
cd backend
npm run debug:all
```

Manual: sign in as tourist → Home search, sightings, profile language, culture media. Sign in as `demo_it` → Admin dashboard feedback queue + content approval.
