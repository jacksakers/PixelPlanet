/**
 * PixelPlanet - Phase 2 Engine
 *
 * Physics are now fully data-driven: entities and rules are loaded at runtime
 * via engine_load_config() from a JSON payload produced by the React UI.
 *
 * Exported C API:
 *   engine_init(w, h)                 — allocate grid
 *   engine_get_cells()                — pointer → Uint8Array in WASM memory
 *   engine_set_pixel(x, y, type)      — paint a single cell
 *   engine_update()                   — advance simulation one tick
 *   engine_load_config(jsonStr)       — load entities + rules from JSON
 *   engine_set_seed(seed)             — reset deterministic RNG seed
 */

#include <emscripten.h>
#include <cstdint>

#include "core/grid.hpp"
#include "core/entity.hpp"
#include "logic/evaluator.hpp"
#include "logic/parser.hpp"
#include "math/rng.hpp"

using namespace pp;

extern "C" {

EMSCRIPTEN_KEEPALIVE
void engine_init(int w, int h) {
    g_grid.allocate(w, h);
}

/** Returns a direct pointer into WASM linear memory — JS wraps it as Uint8Array. */
EMSCRIPTEN_KEEPALIVE
uint8_t* engine_get_cells() {
    return g_grid.read;
}

EMSCRIPTEN_KEEPALIVE
void engine_set_pixel(int x, int y, uint8_t type) {
    if (g_grid.valid(x, y))
        g_grid.read[g_grid.idx(x, y)] = type;
}

EMSCRIPTEN_KEEPALIVE
void engine_update() {
    evaluateTick();
}

/**
 * Load (or reload) entities and rules from a JSON config string.
 * The string is UTF-8 encoded and passed via Emscripten ccall.
 * Returns 1 on success, 0 on parse error.
 */
EMSCRIPTEN_KEEPALIVE
int engine_load_config(const char* json) {
    return parseConfig(json) ? 1 : 0;
}

/** Reset the deterministic RNG seed (useful when loading a save). */
EMSCRIPTEN_KEEPALIVE
void engine_set_seed(uint32_t seed) {
    rng_seed(seed);
}

} // extern "C"
