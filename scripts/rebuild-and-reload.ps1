# scripts/rebuild-and-reload.ps1
# ---------------------------------------------------------------------------
# Fast inner-loop script for engine iteration:
#   Recompiles WASM only (skips npm install, leaves Vite running).
#   The Vite dev server will auto-detect the changed .js/.wasm files in
#   public/wasm/ and trigger a full browser reload automatically.
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "[rebuild] Recompiling WASM engine..." -ForegroundColor Cyan

Set-Location (Join-Path $Root "engine")
& ".\build.ps1"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[rebuild] Done - Vite will reload the browser." -ForegroundColor Green
} else {
    Write-Host "[rebuild] Build failed." -ForegroundColor Red
    exit 1
}
