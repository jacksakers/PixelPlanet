# rebuild-engine.ps1
# Recompiles the Rust WASM engine and copies bindings into the UI source tree.
# Run this script whenever you change code under /engine/src/.

$env:PATH += ";$env:USERPROFILE\.cargo\bin"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$root\engine"

Write-Host "Building WASM engine..." -ForegroundColor Cyan
wasm-pack build --target web --out-dir ..\ui\src\wasm

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful. WASM output is in ui/src/wasm/" -ForegroundColor Green
} else {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}
