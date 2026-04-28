# SIGTS Functional Requirements Tracker

Source of truth: section `3.1` functional requirements provided by project owner.

Status key:
- `implemented` - backend/frontend flow exists and is operational.
- `partial` - scaffold exists but missing required depth/quality.
- `missing` - not implemented.

## 3.1.1.1 Authentication and Access Control

| Component | Status | Notes |
|---|---|---|
| User registration | partial | Role profiles created; email verification still incomplete. |
| Secure login | partial | Access + refresh token now supported; full session lifecycle pending. |
| RBAC | partial | Route-level role checks exist; permission granularity pending. |
| Password management | partial | Reset flow service exists but routes/UI completion pending. |
| Session management | partial | JWT expiry present; inactivity/session revocation pending. |
| MFA | missing | Not yet implemented for IT manager role. |
| Profile management | partial | Read/update exists in parts; needs full coverage/UI parity. |
| Account deactivation | implemented | Self-deactivation endpoint added in auth module. |
| Location validation | partial | Geofence-aware auth supported; global enforcement rollout pending. |
| Guest access | partial | Guest session endpoint added; policy and cleanup lifecycle pending. |

Recent progress:
- Added `/api/auth/forgot-password` and `/api/auth/reset-password` with expiring reset tokens.
- Added IT manager authenticator MFA setup/verification and MFA-complete login flow.
- Frontend login now supports MFA challenge completion and forgot-password trigger.
- Added in-app IT manager MFA setup action in profile/admin UI (setup + verify flow).

## 3.1.1.2 Geofencing and Location Services

Current baseline:
- Park boundary storage is in PostGIS (`parks.geofence_boundary`).
- Geofence validation endpoint exists (`/api/geofence/validate`).
- Auth entrypoint now supports geofence-aware access decisions.
- Operational route groups now enforce inside-park checks for active use flows (`tours`, `sightings`, `sync`).
- Location update endpoint now logs history and emits entry/exit events (`/api/geofence/location-update`).
- Client geolocation updates are sent to backend when authenticated.

Remaining gaps:
- Continuous GPS ingestion pipeline.
- Entry/exit event engine.
- POI radius triggers + push path.
- Offline location queue + reconciliation.

## Next implementation slices (ordered)

1. **Global geofence middleware rollout**
   - Apply park-presence checks to protected operational routes (`tours`, `sightings`, `sync`, `admin` configurable).
2. **Password reset completion**
   - Add forgot/reset endpoints + token persistence + frontend flows.
3. **MFA for IT managers**
   - TOTP setup/verify + enforcement policy.
4. **Guest lifecycle management**
   - Expiry policy + scheduled cleanup for guest accounts.
5. **FR matrix expansion**
   - Add module-by-module status rows for `3.1.1.3` through `3.1.1.12` as implementation continues.
