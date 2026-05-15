# scripts/dev.ps1
# ---------------------------------------------------------------------------
# One-shot dev startup:
#   1. Compile C++ engine → WASM  (skipped with -SkipBuild flag)
#   2. Install UI npm deps if node_modules is missing
#   3. Start Vite dev server
#
# Usage:
#   .\scripts\dev.ps1              # build engine, then start UI
#   .\scripts\dev.ps1 -SkipBuild   # skip engine build (faster iteration)
# ---------------------------------------------------------------------------

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  PixelPlanet - Dev Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host ""

# ---------------------------------------------------------------------------
# Step 1 - Build WASM engine
# ---------------------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "[1/3] Building WASM engine..." -ForegroundColor Cyan
    Set-Location (Join-Path $Root "engine")
    & ".\build.ps1"

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Engine build failed." -ForegroundColor Red
        Write-Host "Start the UI anyway with:  .\scripts\dev.ps1 -SkipBuild" -ForegroundColor Yellow
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "[1/3] Skipping engine build (-SkipBuild flag set)." -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Step 2 - Install UI dependencies if needed
# ---------------------------------------------------------------------------
$UiDir = Join-Path $Root "ui"
Set-Location $UiDir

if (-not (Test-Path (Join-Path $UiDir "node_modules"))) {
    Write-Host "[2/3] Installing UI dependencies (npm install)..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[2/3] node_modules present - skipping npm install." -ForegroundColor DarkGray
}

Write-Host ""

# ---------------------------------------------------------------------------
# Step 3 - Start Vite dev server
# ---------------------------------------------------------------------------
Write-Host "[3/3] Starting Vite dev server at http://localhost:5173" -ForegroundColor Cyan
Write-Host "      Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

npm run dev
