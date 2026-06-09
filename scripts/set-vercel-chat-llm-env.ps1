# Enable the SIGTS grounded AI chat LLM on Vercel.
# The chatbot stays grounded on your PostgreSQL knowledge pack; the LLM just
# phrases answers. Without these vars the app uses the offline rule-based KB.
#
# Usage (OpenAI):
#   .\scripts\set-vercel-chat-llm-env.ps1 -ApiKey "sk-..."
# Usage (OpenAI-compatible proxy / different model):
#   .\scripts\set-vercel-chat-llm-env.ps1 -ApiKey "..." -BaseUrl "https://api.openai.com" -Model "gpt-4o-mini"

param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string]$BaseUrl,
    [string]$Model = "gpt-4o-mini",
    [string]$PublicAppUrl = "https://sigts-static.vercel.app"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Add-VercelEnv($Name, $Value) {
    if (-not $Value) { return }
    Write-Host "Setting $Name on Vercel (production)..."
    $Value | vercel env add $Name production --force 2>&1 | Out-String | Write-Host
}

Add-VercelEnv "SIGTS_CHAT_OPENAI_API_KEY" $ApiKey
Add-VercelEnv "SIGTS_CHAT_MODEL" $Model
if ($BaseUrl) { Add-VercelEnv "SIGTS_CHAT_OPENAI_BASE" $BaseUrl }
# Make sure the LLM is not force-disabled by a stale flag.
Add-VercelEnv "SIGTS_CHAT_DISABLE_LLM" "false"

Write-Host ""
Write-Host "Done. Redeploy with: vercel deploy --prod --yes"
Write-Host "Then verify in the app: open the AI chat, ask a question, and the response meta 'llm_configured' should be true (nlp_mode = llm_grounded_v1)."
