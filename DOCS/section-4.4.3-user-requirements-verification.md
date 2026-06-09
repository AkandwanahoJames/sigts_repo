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
| 3 | Interactive maps and navigation | **Functional** | Leaflet map; OSRM foot routing + GeoJSON trail on map; device compass; turn-by-turn steps |
| 4 | Location-based notifications and recommendations | **Functional** | Server POI proximity → `notifications` table; in-app bell; browser Notification API opt-in (Profile); geofence toasts; dashboard AI recs |
| 5 | Search tourism information and nearby attractions | **Functional** | Home unified search + `GET /api/animals?search=`; locations/culture filtered client-side from API cache |
| 6 | Save and bookmark favorite content | **Functional** | `user_bookmarks` table (migration 016); sync on login via `ContentManager` |
| 7 | Weather updates and safety guidelines | **Functional** | Open-Meteo + fallback; staying-safe guide, safety tips, FAQs from PostgreSQL |
| 8 | Multimedia (audio guides, videos) | **Functional** | Detail modals render `audio_url` / `video_url` when present in DB |
| 9 | Submit wildlife sighting reports | **Functional** | `POST /api/sightings` + offline queue sync |
| 10 | Rate tours and provide feedback | **Functional** | Profile feedback → `POST /api/feedback` |
| 11 | Multilingual tourism information | **Functional** | Profile `language_pref` (en/fr/local); culture, FAQs, park guide use `_local` fields; views refresh on language save |

---

## Tour guides (§4.4.3)

| # | Requirement | Status | Implementation evidence |
|---|-------------|--------|-------------------------|
| 1 | View assigned tour schedules | **Functional** | `GET /api/tours/schedule`, guide dashboard |
| 2 | Access guest information and tour details | **Functional** | Guest list, preparation checklist, guest profile modal |
| 3 | Track tourists during active tours | **Functional** | Live guest map on guide dashboard; `GET /api/tours/:id/active-mode`; 12s GPS refresh; `last_location_time` on location updates |
| 4 | Record wildlife sightings during tours | **Functional** | `quickSighting()` → `POST /api/sightings` |
| 5 | View and manage tour reports | **Functional** | Completion report GET/PUT with guide notes save/submit |
| 6 | Communicate with guides and park officials | **Functional** | Guide/IT messaging (`/api/guides/messages`); emergency `tel:` links; IT peers in message selector |
| 7 | Emergency communication services | **Functional** | Emergency contacts with clickable phone links |
| 8 | Provide tourism information to tourists | **Functional** | Shared wildlife/culture/map/AI views |
| 9 | Monitor tour progress and activities | **Functional** | Start/end tour, timer, active-mode panel, location sync |

---

## IT managers / administrators (§4.4.3)

| # | Requirement | Status | Implementation evidence |
|---|-------------|--------|-------------------------|
| 1 | Manage user accounts and permissions | **Functional** | Create user, role update, deactivate on Admin dashboard |
| 2 | Manage system database and server | **Functional** | System health + **Database tables** panel (`GET /admin/schema-status` row counts) |
| 3 | Configure park boundaries and POIs | **Functional** | Add/delete POI forms + catalogue list; REST boundary/safe-zone APIs (`PUT /admin/parks/boundary`) |
| 4 | Manage tourism content and multimedia | **Functional** | Admin **Content management** panel — create FAQs (incl. local fields) and safety tips |
| 5 | Approve cultural narratives and wildlife info | **Functional** | Content approval panel (cultural verify/publish, AI approve/reject) |
| 6 | Monitor system performance and analytics | **Functional** | IT dashboard + Predictive Analytics workspace |
| 7 | Generate reports and system statistics | **Functional** | Report build/export/schedules in predictive analytics |
| 8 | Manage backups and system security | **Functional** | Backup create/list UI; audit log; alert rules UI; MFA setup |
| 9 | Respond to user feedback and technical issues | **Functional** | Visitor feedback queue with respond workflow |

---

## Summary

| Role | Functional | Partial | Not met |
|------|------------|---------|---------|
| Tourist | 11 | 0 | 0 |
| Guide | 9 | 0 | 0 |
| IT manager | 9 | 0 | 0 |

**All §4.4.3 requirements are fully functional** against the project specification scope (web PWA + PostgreSQL API). Native SMS push and drag-map polygon editors remain out of scope for this stack.

## Recent fixes (2026-06-09, partials closure)

- Map: OSRM geometry polyline on map, device compass button
- Proximity: server-side POI alerts → `notifications` + browser opt-in
- Guide: live guest tracking map with auto-refresh
- IT: schema table console, CMS (FAQ/tips), POI catalogue delete, backups, alert rules
- Multilingual: content views invalidate/reload on language save

## Verification commands

```powershell
cd backend
npm run migrate:up
npm run debug:all
```

Manual smoke: tourist → Profile browser alerts, map Guide Me, notification bell. Guide → start tour, guest map. IT → Admin dashboard all ops panels.
