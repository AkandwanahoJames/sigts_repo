# SIGTS Functional Requirements Tracker (§3.1)

This maps **section 3.1 / §4.4.4** functional components to the **current codebase**. It is the checklist for product and engineering; not every row is fully implemented.

**Last API verification:** 2026-05-26 — `cd backend && npm run debug:all` → **23 pass, 0 fail** (local PostgreSQL `sigts_bwindi`, port 8001).

**Status key**

| Status | Meaning |
|--------|---------|
| **implemented** | End-to-end behaviour exists (API and/or UI + persistence as appropriate). |
| **partial** | Scaffold, demo, or subset only; needs expansion to match the specification. |
| **missing** | No meaningful implementation found. |

**Primary route / entry files**

| Area | Backend | Frontend (public app) |
|------|---------|------------------------|
| Auth & sessions | `backend/src/routes/auth.js`, `middleware/auth.js` | `frontend/public/js/app-managers.js` (`AuthManager`) |
| Geofence & location | `backend/src/routes/geofence.js`, `middleware/parkGeofence.js` | `GeofenceManager` in `app-managers.js`, map in `app-views.js` |
| Content | `routes/animals.js`, `locations.js`, `cultural.js`, seed SQL | `ContentManager`, `app-views.js` |
| Map & nav | `locations.js`, geofence boundary | Leaflet UI in `app-views.js` |
| Guide / tours | `routes/tours.js` | `guide_dashboard`, tour actions in `app-views.js`, `app.js` |
| AI | `routes/ai.js` | Tour help / AI panels in `app-views.js`, `AIRecommendationEngine` |
| Sightings | `routes/sightings.js` | Sightings views, `quickSighting` etc. |
| Offline / sync | `routes/sync.js`, `public/sw.js` | `OfflineSyncManager`, `localStorage` caches |
| Admin | `routes/admin.js` | IT / intranet flows via `ITAPI`, `Intranet` |
| Analytics | `routes/analytics.js` | IT-only API; UI may be partial |
| Feedback | `routes/feedback.js` | `submitContentHelpfulness`, feedback APIs in `app-data.js` |

---

## 3.1.1 User authentication and access control

| Component | Status | Where / notes |
|-----------|--------|----------------|
| User registration | partial | `POST /api/auth/register` — creates user; **email verification** after signup not fully wired as a gate. |
| Secure login | implemented | JWT access + **refresh** rotation (`refreshTokenService`, `POST /api/auth/refresh`); login in `auth.js`. |
| RBAC | partial | `authenticateJWT`, `authorize(role)` on routes; tourist / guide / `it_manager`; not a fine-grained permission matrix. |
| Password management | implemented | `POST /api/auth/forgot-password`, `reset-password` + `emailService`; UI flows exist in app where wired. |
| Session management | partial | JWT TTL, refresh family + reuse detection; **idle timeout** / forced re-login UX is basic (`AuthManager.sessionTimeout`). |
| Multi-Factor Authentication | partial | **Authenticator (TOTP)** for IT manager: `mfa/setup`, `mfa/verify-setup`, `mfa/complete` in `auth.js`. **SMS MFA** not implemented. |
| Profile management | partial | `routes/users.js` profile GET/PUT; coverage depends on UI screens. |
| Account deactivation | implemented | Self-deactivate in `auth.js` (with audit / family revoke as applicable). |
| Location validation | partial | PostGIS inside-park checks (`parkGeofence.js`); applied to **some** route groups in `server.js` (e.g. tours, sightings, sync); **not** universal on all protected routes. |
| Guest access | partial | `POST /api/auth/guest` creates limited user + JWT; **coords required**; expiry/cleanup policy incomplete. |

---

## 3.1.2 Geofencing and location-based services

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Park boundary definition | implemented | `parks.geofence_boundary` (PostGIS); `GET /api/geofence/boundary`. |
| Continuous GPS tracking | partial | Client can send updates; `POST /api/geofence/location-update` persists `location_history` with speed/heading fields. **Background** tracking / OS policies not fully productized. |
| Entry/exit detection | implemented | `geofence_events` on inside/outside transitions in `geofence.js`. |
| POI proximity alert | partial | Locations may have `trigger_radius` in schema; **push notifications** / automated alerts not fully built. |
| Location history logging | implemented | `location_history` inserts in `geofence/location-update`. |
| Distance calculation | partial | Haversine-style logic in map guidance (`app-views.js`); not a dedicated `/api/geo/distance` service. |
| Bearing calculation | partial | Map UI computes bearing / cardinal text (`updateCompassStatus` in `app-views.js`). |
| Speed tracking | partial | Stored on location update when client sends `speed_kmh`; ETA is heuristic UI, not ML. |
| Offline location storage | partial | Offline queue/sync patterns use **localStorage** / sync API; spec’s **SQLite** not the primary store in web client. |
| Geofence violation alert | partial | Events stored; **ranger dispatch** integration not present. |

---

## 3.1.3 Tourist information and content delivery

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Animal information catalog | implemented | `GET /api/animals`, Animals tab, filters/themes. |
| Animal detail view | implemented | Modal / detail flow; images, facts, UNESCO themes. |
| Location information | implemented | `GET /api/locations`, map POIs. |
| Multimedia playback | partial | URLs (`audio_call_url`, `audio_guide_url`, etc.) in schema/data; **full player UX** varies by screen. |
| General destination information | implemented | Info / park snapshot in `app-views.js` (`renderInfoContent`). |
| FAQ section | partial | Seed + routes if present in older seeds; UI coverage verify per deployment. |
| Safety tips | partial | Seeded content; dedicated module depth may vary. |
| Weather information | partial | `Content.getWeather()` / API stub behaviour. |
| Search functionality | partial | Map location search; **global unified search** across all content types is limited. |
| Content bookmarks | partial | `localStorage` bookmarks in `ContentManager`; may not sync server-side per user. |
| Content versioning | partial | Sync/download uses `updated_at`; **explicit version history UI** missing. |
| Multilingual support | partial | Preference fields exist; **content negotiation** / full translations pipeline incomplete. |

---

## 3.1.4 Interactive mapping and navigation

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Map rendering | implemented | Leaflet map in `app-views.js`. |
| Offline map tiles | partial | `cacheVisibleMapTiles`, `sw.js` — caching exists; coverage depends on usage. |
| User location marker | partial | Live position when GPS available (`updateLiveMapMarkers` patterns in `app-views.js`). |
| POI markers | implemented | From locations dataset. |
| Route display | partial | Routes loaded from backend where seeded; layering varies. |
| Point-to-point navigation | partial | Guidance between user and selected destination — simplified routing, not OSRM production stack. |
| Turn-by-turn directions | partial | Text directions list generated in UI; **voice prompts** limited / missing. |
| Map layer toggle | implemented | Layer select for standard/topo/satellite/trails. |
| Distance measurement | implemented | Measure UI hooks in map controls. |
| Location search | partial | Search by name in map overlay. |
| Compass mode | partial | Bearing computed from coordinates; **device compass sensor** fusion not guaranteed. |
| Trail difficulty indicator | partial | Difficulty colouring / labels in guidance helpers (`getTrailDifficulty`). |
| Elevation profile | partial | **Estimated** elevation bars in UI (`renderElevationProfile`), not DEM-backed graph. |
| Nearby POI list | implemented | `mapNearbyList` populated from proximity logic. |

---

## 3.1.5 Tour guide management

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Guide dashboard | partial | Schedule widgets, participants — `renderGuide*` / guide dashboard sections in `app-views.js`. |
| Tour schedule view | partial | Backend `tours/schedule`; UI lists today’s tours. |
| Tour detail preparation | partial | Tour/session detail depth varies. |
| Guest list management | partial | Participants from API where assigned. |
| Guest profile access | partial | Medical notes endpoints exist for authorised roles (`users` routes — IT/guide scope). |
| Active tour mode | partial | Start/end tour flows (`startTour`, `endActiveTour`). |
| Guest tracking | partial | `guestLocations` / live concepts in managers — not full multi-guest realtime product. |
| Tour timer | partial | UI mentions; precise schedule adherence alarms vary. |
| Quick sighting entry | implemented | `quickSighting`, sightings API. |
| Tour notes | partial | Notes endpoints on tours route; UI completeness varies. |
| Shift management | partial | Clock in/out hooks (`clockInOut`). |
| Guide profile | partial | Profile routes + UI fragments. |
| Guide performance stats | partial | Ratings/feedback aggregates possible; dashboard polish varies. |
| Emergency communication | partial | Info / contacts in content; dedicated **panic** channel not universal. |
| Guide-to-guide messaging | implemented | `GET/POST /api/guides/messages`, inbox UI in `app-views.js` (migration 011 `guide_messages`). |
| Tour completion report | partial | Export patterns (`exportData`) — formal PDF report generator not standard. |

---

## 3.1.6 AI-powered recommendations

| Component | Status | Where / notes |
|-----------|--------|----------------|
| User interest profiling | partial | Behaviour can be inferred from feedback/helpfulness; no dedicated **embedding** store. |
| Tour recommendation engine | partial | `AIRecommendationEngine`, dashboard recommendations. |
| Personalized content feed | partial | Dashboard rec cards. |
| Natural language query | implemented | `/api/chat` or equivalent in `routes/ai.js` + Tour help UI. |
| Voice query support | missing | No first-class speech-to-text pipeline in repo. |
| Context-aware responses | partial | Prompt can include coords / placeholders — depth depends on ai route implementation. |
| Learning from feedback | partial | Feedback stored (`feedback` routes); **automated model retraining** not in repo. |
| Similar content suggestions | partial | Can be UX-driven / manual; algorithmic similarity service limited. |
| Popularity-based recommendations | partial | Analytics `popular-content` endpoint. |
| Seasonal recommendations | partial | Seasonal card copy on dashboard. |
| Query logging | partial | Depends on analytics / AI middleware — verify persistence policy. |
| Offline AI mode | partial | Fallback copy / canned responses possible; **on-device ML** not present. |

---

## 3.1.7 Cultural narratives and storytelling

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Story library | implemented | Culture tab + `GET /api/cultural`. |
| Story detail view | implemented | Narrative modal / detail fetch. |
| Audio storytelling | partial | Fields exist; playback UX depends on assets. |
| Video documentation | partial | Same as audio — URL/media pipeline. |
| Storyteller profiles | partial | Storyteller fields / routes where migrated. |
| Community filtering | partial | Filter by community in UI/API where exposed. |
| Location-based stories | partial | Geo-linked narratives not fully automatic. |
| Story transcripts | partial | `narrative_en` / local fields; multilingual transcripts incomplete. |
| Cultural context notes | partial | Significance / metadata in narratives. |
| Verification badge | implemented | Publish/verify workflows (`cultural` PUT verify, migrations). |
| Story of the day | partial | Can be seeded / rotated — **no guaranteed cron** unless added. |
| Language selection | partial | Preference only; full story locale matrix incomplete. |
| Related places | partial | Links to map / locations when wired in content. |

---

## 3.1.8 Sightings and wildlife tracking

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Sighting report form | implemented | `POST /api/sightings` + UI flows. |
| Quick sighting | implemented | Minimal fields path for guides. |
| Recent sightings feed | implemented | List + APIs (`/recent`, etc.). |
| Sighting map | partial | Markers where implemented in map layers. |
| Sighting verification | implemented | Verify endpoint for guides/managers (`sightings.js`). |
| Sighting photos | partial | Upload support where schema and routes allow. |
| Sighting statistics | partial | Aggregation possible; rich chart dashboard may be partial. |
| Rare sighting alert | partial | Polling/alerts stubs exist in client (`rareAlertPollTimer`). |
| Personal sighting history | partial | `mine` endpoints / local history. |
| Species distribution heat map | missing | No dedicated heatmap layer verified. |
| Best time predictions | partial | Analytics / heuristics only; not full ML predictor. |
| Sighting comments | implemented | Comments API + local fallback in `app-data.js`. |

---

## 3.1.9 Offline synchronization

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Initial content download | partial | `downloadOfflineContent`, `sync/download` — **SQLite** replaced by browser storage pattern. |
| Selective download | partial | Manual cache / downloads; granular picker limited. |
| Automatic sync | partial | Online event handlers in `OfflineSyncManager`. |
| Manual sync | partial | User-triggered refresh/download actions. |
| Sync queue | partial | Queue concepts in sync routes + client. |
| Conflict resolution | partial | Minimal merge rules; full UX for conflicts missing. |
| Sync status indicator | partial | Offline banner / state in app. |
| Data versioning | partial | `offline_version`, `sync_version` fields — not full delta engine. |
| Bandwidth management | missing | Connection-type-aware throttling not standard. |
| Storage management | partial | Storage usage hints in managers. |
| Incremental updates | partial | `last_sync` / `updated_at` filters in sync download. |
| Offline mode indicator | implemented | `AppState.offlineMode` / UI. |
| Sync error handling | partial | Retry toasts vary. |
| Background sync | partial | Service worker registered in `app.js` (often disabled/unregistered during dev). |

---

## 3.1.10 IT manager administration

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Admin dashboard | partial | `/api/admin/stats` + intranet UI fragments. |
| User management | implemented | `/api/admin/users` CRUD patterns. |
| Role assignment | implemented | `user_type` updates via admin/users. |
| Content approval queue | partial | AI generation review counts in stats; workflow depth varies. |
| Content creation | partial | Seeds + admin; in-app CMS completeness varies. |
| Bulk content upload | implemented | `POST /api/admin/animals/bulk-json` in `admin.js`. |
| Park boundary configuration | partial | Stored in DB; admin UI for editing polygon may be partial — use migrations/SQL scripts. |
| POI management | partial | Locations admin patterns. |
| Animal catalog management | partial | Animals updates typically via seed/SQL unless admin endpoints extended. |
| Cultural narrative curation | implemented | Verify/publish in `cultural` + IT flows. |
| System configuration | partial | Environment-driven (`requirements.js`, env vars). |
| Audit logs | partial | `audit` utility used in sensitive actions — full viewer TBD. |
| Backup management | partial | `POST /api/admin/backup/create`, `GET /api/admin/backup/list`; CLI `npm run backup`; IT UI exposure varies. |
| Alert configuration | partial | `GET/POST/PUT /api/admin/alert-rules` in `admin.js`; full ops UI may be partial. |
| Guide management | partial | Overlaps users + tours assignments. |
| Report generation | partial | Export helpers; PDF report builder not standard. |

---

## 3.1.11 Predictive analytics and reporting

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Visitor flow analysis | implemented | `/api/analytics/visitor-flow`. |
| Congestion prediction | partial | Reads `congestion_predictions` table; model training pipeline external. |
| Peak time identification | partial | Derivative of visitor-flow / predictions. |
| Resource allocation recommendations | partial | Text recommendations in congestion route. |
| Popular content analytics | implemented | `/api/analytics/popular-content`. |
| User demographics | partial | Limited aggregates; GDPR-sensitive handling required for expansion. |
| Sightings trends | partial | Possible via SQL; dedicated endpoint/UI may be partial. |
| Satisfaction metrics | implemented | `/api/analytics/satisfaction` (+ feedback data). |
| Custom report builder | missing | Not a general drag-and-drop builder. |
| Report scheduling | missing | No cron mailer in repo. |
| Data export | partial | CSV/JSON via custom endpoints or exports — standardize per need. |
| Predictive model training | missing | Out of band (not implemented as app subsystem). |
| Anomaly detection | missing | Dedicated detector not verified. |
| Dashboard visualization | partial | IT dashboards depend on frontend consumption of analytics APIs. |

---

## 3.1.12 Feedback and continuous improvement

| Component | Status | Where / notes |
|-----------|--------|----------------|
| Tour rating | partial | Feedback supports `tour_session_id`, category `tour`. |
| Written reviews | implemented | Comment text on feedback + categories. |
| Content feedback | implemented | Helpfulness submissions (`helpfulness_rating`, content hooks in UI). |
| App feedback form | implemented | `category: app`, bug/feature categories. |
| Bug reporting | implemented | `bug_report`, optional `screenshot_url`. |
| Feature suggestions | implemented | `feature_suggestion` category. |
| Guide rating | partial | `tourguide_id` + `guide` category. |
| Feedback dashboard | implemented | `/api/feedback/dashboard` etc. |
| Feedback response | partial | Manager respond routes in `feedback` expansion migrations. |
| Improvement tracking | partial | `improvement_status` on feedback (migration `008_feedback_improvement_tracking.sql`). |
| Satisfaction surveys | partial | Category `survey` supported. |
| NPS measurement | implemented | `nps_score` on `POST /api/feedback`. |

---

## How to use this document

1. Treat **implemented** rows as regression-test targets during refactors.
2. Prioritize **missing** items that block pilot deployment (SMS MFA, ranger alerts, backups, bulk import, heatmaps — pick per stakeholder).
3. After each sprint, adjust statuses and link new PR paths to keep this aligned with §3.1 wording.
