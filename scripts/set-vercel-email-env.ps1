# Configure SIGTS email on Vercel (SendGrid or Brevo SMTP).
# Usage:
#   .\scripts\set-vercel-email-env.ps1 -SendGridKey "SG.xxxx" -FromEmail "noreply@yourdomain.com"
# Or SMTP:
#   .\scripts\set-vercel-email-env.ps1 -SmtpHost "smtp-relay.brevo.com" -SmtpUser "..." -SmtpPass "..." -FromEmail "..."

param(
    [string]$SendGridKey,
    [string]$FromEmail,
    [string]$FromName = "Bwindi SIGTS",
    [string]$SmtpHost,
    [string]$SmtpUser,
    [string]$SmtpPass,
    [string]$PublicAppUrl = "https://sigts-static.vercel.app"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Add-VercelEnv($Name, $Value) {
    if (-not $Value) { return }
    Write-Host "Setting $Name on Vercel (production)..."
    $Value | vercel env add $Name production --force 2>&1 | Out-String | Write-Host
}

if ($SendGridKey) {
    Add-VercelEnv "SENDGRID_API_KEY" $SendGridKey
}
if ($FromEmail) {
    Add-VercelEnv "SENDGRID_FROM" $FromEmail
    Add-VercelEnv "SMTP_FROM" $FromEmail
}
if ($FromName) {
    Add-VercelEnv "SENDGRID_FROM_NAME" $FromName
}
if ($SmtpHost) { Add-VercelEnv "SMTP_HOST" $SmtpHost }
if ($SmtpUser) { Add-VercelEnv "SMTP_USER" $SmtpUser }
if ($SmtpPass) {
    Add-VercelEnv "SMTP_PASS" $SmtpPass
    Add-VercelEnv "SMTP_PASSWORD" $SmtpPass
}
if ($PublicAppUrl) {
    Add-VercelEnv "PUBLIC_APP_URL" $PublicAppUrl
}

Write-Host ""
Write-Host "Done. Redeploy with: vercel deploy --prod --yes"
Write-Host "Then check: $PublicAppUrl/api/health (notifications.email should be sendgrid or smtp)"
