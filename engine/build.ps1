# engine/build.ps1
# ---------------------------------------------------------------------------
# Compiles src/main.cpp → ../../ui/public/wasm/pixel_planet.{js,wasm}
# Must be run with Emscripten activated in your shell:
#   & "$env:EMSDK\emsdk_env.ps1"
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

$EngineDir = $PSScriptRoot
$OutDir    = Join-Path $EngineDir "..\ui\public\wasm"

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "[engine/build.ps1] Building WASM engine..." -ForegroundColor Cyan

# Verify emcc is available
if (-not (Get-Command emcc -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERROR: 'emcc' not found in PATH." -ForegroundColor Red
    Write-Host "Install Emscripten from https://emscripten.org/docs/getting_started/downloads.html" -ForegroundColor Yellow
    Write-Host "Then activate it:  & `"`$env:EMSDK\emsdk_env.ps1`"" -ForegroundColor Yellow
    exit 1
}

$OutFile = Join-Path $OutDir "pixel_planet.js"

$emccArgs = @(
    "src/main.cpp",
    "src/core/entity.cpp",
    "src/core/grid.cpp",
    "src/logic/rule.cpp",
    "src/logic/parser.cpp",
    "src/logic/evaluator.cpp",
    "-I", "src",
    "-std=c++17",
    "-O2",
    "-fexceptions",
    "-sWASM=1",
    "-sMODULARIZE=1",
    "-sEXPORT_NAME=PixelPlanetEngine",
    "-sEXPORTED_FUNCTIONS=_engine_init,_engine_get_cells,_engine_set_pixel,_engine_update,_engine_load_config,_engine_set_seed",
    "-sEXPORTED_RUNTIME_METHODS=HEAPU8,ccall,cwrap",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sENVIRONMENT=web,worker",
    "--no-entry",
    "-o", $OutFile
)

Push-Location $EngineDir
try {
    emcc @emccArgs
    if ($LASTEXITCODE -ne 0) { throw "emcc exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Build successful!" -ForegroundColor Green
Write-Host "  JS : $OutFile"
Write-Host "  WASM: $($OutFile -replace '\.js$', '.wasm')"
