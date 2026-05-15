# scripts/build-engine.ps1
# ---------------------------------------------------------------------------
# Convenience wrapper - call from anywhere in the repo.
# Compiles the C++ engine to WASM and places the output in
# ui/public/wasm/ so the Vite dev server can serve it immediately.
# ---------------------------------------------------------------------------

$Root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  PixelPlanet - Build WASM Engine" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host ""

Set-Location (Join-Path $Root "engine")
& ".\build.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed. See output above." -ForegroundColor Red
    exit $LASTEXITCODE
}
