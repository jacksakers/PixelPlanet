#!/bin/bash
# engine/build.sh
# ---------------------------------------------------------------------------
# Compiles src/main.cpp → ../../ui/public/wasm/pixel_planet.{js,wasm}
# Must have Emscripten installed and activated:
#   source /path/to/emsdk/emsdk_env.sh
# ---------------------------------------------------------------------------

set -e

ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$ENGINE_DIR/../ui/public/wasm"

# Ensure output directory exists
mkdir -p "$OUT_DIR"

echo "[engine/build.sh] Building WASM engine..."

# Verify emcc is available
if ! command -v emcc &> /dev/null; then
    echo ""
    echo "ERROR: 'emcc' not found in PATH." >&2
    echo "Install Emscripten from https://emscripten.org/docs/getting_started/downloads.html" >&2
    echo "Then activate it: source /path/to/emsdk/emsdk_env.sh" >&2
    exit 1
fi

OUT_FILE="$OUT_DIR/pixel_planet.js"

# Build with emcc
cd "$ENGINE_DIR"
emcc \
    src/main.cpp \
    src/core/entity.cpp \
    src/core/grid.cpp \
    src/logic/rule.cpp \
    src/logic/parser.cpp \
    src/logic/evaluator.cpp \
    -I src \
    -std=c++17 \
    -O2 \
    -fexceptions \
    -sWASM=1 \
    -sMODULARIZE=1 \
    -sEXPORT_NAME=PixelPlanetEngine \
    -sEXPORTED_FUNCTIONS=_engine_init,_engine_get_cells,_engine_get_color_table,_engine_set_pixel,_engine_update,_engine_load_config,_engine_set_seed,_engine_send_click,_engine_set_button_state,_engine_get_score,_engine_get_game_state,_engine_reset_game \
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,ccall,cwrap \
    -sALLOW_MEMORY_GROWTH=1 \
    -sENVIRONMENT=web,worker \
    --no-entry \
    -o "$OUT_FILE"

echo ""
echo "Build successful!"
echo "  JS : $OUT_FILE"
echo "  WASM: ${OUT_FILE%.js}.wasm"
