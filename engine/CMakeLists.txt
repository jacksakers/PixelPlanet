# PixelPlanet Engine - CMakeLists.txt
#
# Usage (from engine/ with Emscripten active):
#   cmake -B build -DCMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
#   cmake --build build
#
# Output is written to ../ui/public/wasm/

cmake_minimum_required(VERSION 3.15)
project(pixel_planet CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# Source
# ---------------------------------------------------------------------------
add_executable(pixel_planet
    src/main.cpp
    src/core/entity.cpp
    src/core/grid.cpp
    src/logic/rule.cpp
    src/logic/parser.cpp
    src/logic/evaluator.cpp
)

target_include_directories(pixel_planet PRIVATE src)

# ---------------------------------------------------------------------------
# Emscripten link flags
# ---------------------------------------------------------------------------
set(EXPORTED_FNS
    "_engine_init"
    "_engine_get_cells"
    "_engine_set_pixel"
    "_engine_update"
    "_engine_load_config"
    "_engine_set_seed"
)
string(JOIN "," EXPORTED_FNS_STR ${EXPORTED_FNS})

target_link_options(pixel_planet PRIVATE
    -O2
    -sWASM=1
    -sMODULARIZE=1
    "-sEXPORT_NAME=PixelPlanetEngine"
    "-sEXPORTED_FUNCTIONS=[${EXPORTED_FNS_STR}]"
    "-sEXPORTED_RUNTIME_METHODS=[HEAPU8,ccall,cwrap]"
    -sALLOW_MEMORY_GROWTH=1
    "-sENVIRONMENT=web,worker"
    --no-entry
)

set_target_properties(pixel_planet PROPERTIES
    SUFFIX ".js"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../ui/public/wasm"
)
