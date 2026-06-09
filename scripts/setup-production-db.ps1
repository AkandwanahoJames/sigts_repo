# Sync Supabase URLs to Vercel and run migrations. Requires backend/.env.supabase
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $repoRoot 'backend\.env.supabase'

if (-not (Test-Path $envFile)) {
    Write-Host "Missing $envFile" -ForegroundColor Red
    Write-Host "Copy backend\.env.supabase.example to backend\.env.supabase and set DATABASE_PASSWORD."
    exit 1
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $vars[$matches[1].Trim()] = $matches[2].Trim().Trim('"')
    }
}

function Encode-DbPassword([string]$Password) {
    [uri]::EscapeDataString($Password)
}

$pooler = $vars['DATABASE_URL_POOLER']
$direct = $vars['DATABASE_URL_DIRECT']

if ($vars['DATABASE_PASSWORD'] -and $vars['DATABASE_PASSWORD'] -notmatch 'YOUR_PASSWORD') {
    $ref = $vars['SUPABASE_PROJECT_REF']
    if (-not $ref) { $ref = 'hjculkldwjrsifvnaugy' }
    $region = $vars['SUPABASE_POOLER_REGION']
    if (-not $region) { $region = 'eu-west-1' }
    $enc = Encode-DbPassword $vars['DATABASE_PASSWORD']
    $pooler = "postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:6543/postgres"
    $direct = "postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres"
}

if (-not $pooler -or $pooler -match '\[YOUR-PASSWORD\]|YOUR_PASSWORD') {
    Write-Host 'Set DATABASE_PASSWORD (or full DATABASE_URL_POOLER) in backend\.env.supabase' -ForegroundColor Red
    exit 1
}

Write-Host 'Testing Supabase connectivity before deploy...' -ForegroundColor Cyan
Set-Location (Join-Path $repoRoot 'backend')
node scripts/test-supabase-urls.js
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Database test failed. Fix backend\.env.supabase first:' -ForegroundColor Red
    Write-Host '  1. Open https://supabase.com/dashboard → your project → Connect'
    Write-Host '  2. Copy Transaction pooler URI (port 6543)'
    Write-Host '  3. Paste into DATABASE_URL_POOLER in backend\.env.supabase'
    Write-Host '  4. Re-run: .\scripts\setup-production-db.ps1'
    exit 1
}
Set-Location $repoRoot
if (-not $direct -or $direct -match '\[YOUR-PASSWORD\]|YOUR_PASSWORD') {
    Write-Host 'Set DATABASE_PASSWORD (or full DATABASE_URL_DIRECT) in backend\.env.supabase' -ForegroundColor Red
    exit 1
}

Write-Host 'Updating Vercel DATABASE_URL (production)...' -ForegroundColor Cyan
Set-Location $repoRoot
echo $pooler | vercel env rm DATABASE_URL production --yes 2>$null
echo $pooler | vercel env add DATABASE_URL production --yes

Write-Host 'Running migrations + seed on Supabase...' -ForegroundColor Cyan
Set-Location (Join-Path $repoRoot 'backend')
# Direct IPv6 may fail locally; try session pooler (5432) for migrations when direct host is db.*.supabase.co
$migrateUrl = $direct
if ($direct -match '@db\.([a-z0-9]+)\.supabase\.co:5432') {
    $ref = $Matches[1]
    $enc = if ($vars['DATABASE_PASSWORD']) { Encode-DbPassword $vars['DATABASE_PASSWORD'] } else { ($direct -split ':')[2] -replace '@.*','' }
    $region = $vars['SUPABASE_POOLER_REGION']
    if (-not $region) { $region = 'eu-west-1' }
    $migrateUrl = "postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:5432/postgres"
    Write-Host 'Using session pooler for migrations (IPv4)...' -ForegroundColor Yellow
}
$env:DATABASE_URL = $migrateUrl
$env:NODE_ENV = 'production'
npm run deploy-prep -- --seed-interactive

Write-Host 'Deploying to Vercel production...' -ForegroundColor Cyan
Set-Location $repoRoot
vercel deploy --prod --yes
vercel alias sigts-static.vercel.app sigts.vercel.app 2>$null

Write-Host 'Health check:' -ForegroundColor Cyan
Start-Sleep -Seconds 10
curl.exe -sS -m 60 'https://sigts.vercel.app/api/health'
