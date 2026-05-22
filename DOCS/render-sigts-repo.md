# Render API — sigts-repo

**Service URL:** https://sigts-repo.onrender.com  
**API base:** `https://sigts-repo.onrender.com/api`  
**Health:** https://sigts-repo.onrender.com/api/health

**Vercel frontend:** https://sigts.vercel.app  
**Vercel project ID:** `prj_lCk0OiiFYaqnkJAuPguFajCvD5Xf`

**Supabase project:** https://hjculkldwjrsifvnaugy.supabase.co  
**Supabase ref:** `hjculkldwjrsifvnaugy`

## Render environment variables

Set in **Render → sigts-repo → Environment**:

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `PORT` | `8000` |
| `HOST` | `0.0.0.0` |
| `JWT_SECRET` | 64-char hex (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `DATABASE_URL` | Supabase **Database URI** (port 5432) |
| `CLIENT_URL` | `https://sigts.vercel.app` |
| `PUBLIC_APP_URL` | `https://sigts.vercel.app` |

After saving, trigger **Manual Deploy**. First request after idle may take 30–60s on the free tier.

## Vercel environment variables

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `API_URL` | `https://sigts-repo.onrender.com/api` |
| `MAP_TILES_URL` | `/tiles` |
| `PARK_NAME` | `Bwindi Impenetrable National Park` |
| `DEFAULT_LANGUAGE` | `en` |

Build command: `npm run build --workspace=sigts-frontend`  
Output directory: `frontend/public`

**Vercel Root Directory:** leave empty (repo root), or set to `frontend`.  
If it is `backend`, use the included `backend/vercel.json` (builds the static app from the monorepo root).  
Do **not** use the Express preset — this deploy is static only.

## Local build pointing at Render

```powershell
cd c:\Projects\SIGTS
# frontend/.env already sets API_URL to sigts-repo
npm run build:frontend
```

## Database (one-time)

```powershell
$env:DATABASE_URL="<supabase-uri>"
npm run db:deploy-prep -- --seed-interactive
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Health URL times out | Service sleeping or deploy failed — open Render **Logs**, redeploy |
| CORS error in browser | Set `CLIENT_URL` on Render to exact Vercel origin (no trailing slash) |
| `database: disconnected` | Add `DATABASE_URL`, run `npm run db:deploy-prep` |
| 401 / login fails | Run migrations + seed; check `JWT_SECRET` is set on Render |
