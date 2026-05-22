# Deployment Environment Variables

Recommended production layout:

| Layer | Host | Role |
|-------|------|------|
| Frontend | **Vercel** | Static PWA (`frontend/public`) |
| API | **Render** | Node server (`backend/src/server.js`) |
| Database | **Supabase** | Managed PostgreSQL + PostGIS |

Root `vercel.json` is **frontend-only** (Vercel + Render + Supabase). For API on Vercel too, use `vercel.fullstack.json` instead.

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Database → Extensions**: enable **PostGIS** (required by migrations).
3. **Project Settings → Database**:
   - **Connection string → URI** (direct, port `5432`) — use on **Render** for migrations and the API.
   - **Connection pooling → Transaction** (port `6543`) — optional for serverless; Render can use direct `5432`.
4. Run migrations once (from your machine or Render shell):

```bash
cd backend
# Set DATABASE_URL to the Supabase URI (Settings → Database → URI)
npm run migrate
```

5. Optional seed:

```bash
npm run seed:interactive
```

### Supabase env on Render (preferred)

Set a single connection string (SSL is applied automatically):

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres
```

Or discrete vars (same values as in Supabase **Database** settings):

```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<database-password>
DB_SSL=true
```

Do **not** commit the service role key to the backend; the backend only needs the database password / `DATABASE_URL`.

---

SIGTS has two environment surfaces:

- Backend/API envs: secrets, database, auth, email/SMS, server behavior.
- Frontend envs: public browser runtime config only.

Do not put backend secrets in frontend or Vercel static frontend variables.

## Backend Required

Set these on the service that runs `backend/src/server.js` or the Vercel serverless function in `api/index.js`.

```env
NODE_ENV=production
JWT_SECRET=<64+ hex chars or another strong 32+ char secret>
DATABASE_URL=<supabase-or-hosted-postgres-uri>
CLIENT_URL=https://your-frontend-domain.example
```

Or discrete DB vars instead of `DATABASE_URL`:

```env
DB_HOST=<hosted-postgres-host-not-localhost>
DB_PORT=5432
DB_NAME=<database-name>
DB_USER=<database-user>
DB_PASSWORD=<database-password>
```

Notes:

- Prefer `DATABASE_URL` for Supabase.
- `DB_HOST` cannot be `localhost` in production (unless `DATABASE_URL` is set).
- `JWT_SECRET` must not contain placeholders like `secret`, `changeme`, or `replace-me`.
- If frontend and backend are on different domains, `CLIENT_URL` must include the frontend origin exactly.
- If you have more than one frontend origin, use comma-separated values.

## Backend Optional

```env
PUBLIC_APP_URL=https://your-frontend-domain.example
JWT_REFRESH_SECRET=<strong-refresh-secret>
JWT_MFA_SECRET=<strong-mfa-secret>
JWT_EMAIL_VERIFICATION_SECRET=<strong-email-secret>
JWT_ACCESS_TTL=24h
JWT_REFRESH_TTL=7d
SESSION_IDLE_TIMEOUT_MINUTES=30

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password-or-app-password>
SMTP_FROM=noreply@bwindi.com

TWILIO_ACCOUNT_SID=<twilio-sid>
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_FROM_NUMBER=<twilio-number>

SIGTS_CHAT_OPENAI_API_KEY=<api-key>
SIGTS_CHAT_OPENAI_BASE=https://api.openai.com
SIGTS_CHAT_MODEL=gpt-4o
SIGTS_CHAT_DISABLE_LLM=false

DISABLE_API_RATE_LIMIT=false
ENABLE_AUTH_RATE_LIMIT=true
GENERAL_RATE_LIMIT_MAX=3000
AUTH_RATE_LIMIT_MAX=20
ENFORCE_PARK_GEOFENCE=true
```

## Frontend Required

Same Vercel project as the API:

```env
NODE_ENV=production
API_URL=
API_PORT=
MAP_TILES_URL=/tiles
PARK_NAME=Bwindi Impenetrable National Park
DEFAULT_LANGUAGE=en
```

Separate frontend on Vercel and backend on Render:

```env
NODE_ENV=production
API_URL=https://sigts-repo.onrender.com/api
MAP_TILES_URL=/tiles
PARK_NAME=Bwindi Impenetrable National Park
DEFAULT_LANGUAGE=en
```

The frontend variables are baked into `frontend/public/runtime-config.js` by:

```bash
npm run predev --workspace=frontend
```

## Vercel Checklist

Use these when deploying the whole repo to Vercel:

```env
NODE_ENV=production
JWT_SECRET=<strong-secret>
DB_HOST=<hosted-postgres-host>
DB_PORT=5432
DB_NAME=<database-name>
DB_USER=<database-user>
DB_PASSWORD=<database-password>
CLIENT_URL=https://your-vercel-app.vercel.app
MAP_TILES_URL=/tiles
PARK_NAME=Bwindi Impenetrable National Park
DEFAULT_LANGUAGE=en
```

The app should respond at:

- `https://your-vercel-app.vercel.app/`
- `https://your-vercel-app.vercel.app/api/health`

## Render Backend Checklist

Use these when Render runs the backend and Vercel hosts the frontend.

**Render dashboard**

1. **New → Web Service** → connect the SIGTS repo.
2. **Root Directory**: `backend`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Health Check Path**: `/api/health`

Or import `render.yaml` from the repo root.

**Environment variables**

```env
NODE_ENV=production
PORT=8000
HOST=0.0.0.0
JWT_SECRET=<strong-secret>
DATABASE_URL=<supabase-uri-from-dashboard>
CLIENT_URL=https://your-vercel-frontend.vercel.app
PUBLIC_APP_URL=https://your-vercel-frontend.vercel.app
```

**Vercel (frontend only)**

1. Connect the repo — root `vercel.json` is already frontend-only.
2. **Build Command**: `npm run build:frontend` (or `npm run predev --workspace=frontend`)
3. **Output Directory**: `frontend/public`
4. Environment. Vercel injects these into `process.env`; `frontend/scripts/generateRuntimeConfig.js` writes them into `frontend/public/runtime-config.js` during the build:

```env
NODE_ENV=production
API_URL=https://sigts-repo.onrender.com/api
MAP_TILES_URL=/tiles
PARK_NAME=Bwindi Impenetrable National Park
DEFAULT_LANGUAGE=en
```

**Smoke test**

- Frontend: `https://your-app.vercel.app/`
- API health: `https://sigts-repo.onrender.com/api/health`
- Browser console on Vercel: `window.__SIGTS_API_BASE__` should equal the Render `/api` URL.
