/**
 * PixelPlanet - Phase 3+ Engine
 *
 * Physics are fully data-driven: entities and rules are loaded at runtime
 * via engine_load_config() from a JSON payload produced by the React UI.
 *
 * Exported C API:
 *   engine_init(w, h)                        — allocate grid
 *   engine_get_cells()                        — pointer → Uint8Array in WASM memory
 *   engine_set_pixel(x, y, type)              — paint a single cell
 *   engine_update()                           — advance simulation one tick
 *   engine_load_config(jsonStr)               — load entities + rules from JSON
 *   engine_set_seed(seed)                     — reset deterministic RNG seed
 *   engine_send_click(x, y)                   — fire OnClick rules for cell at (x, y)
 *   engine_set_button_state(key, isDown)       — set held direction key (0=up,1=down,2=left,3=right)
 *   engine_get_score()                        — get current game score
 *   engine_get_game_state()                   — 0=idle, 1=active, 2=ended
 *   engine_reset_game()                       — reset score and game state to idle
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
    if (!g_grid.valid(x, y)) return;
    int i = g_grid.idx(x, y);
    g_grid.read[i] = type;
    // Initialise per-cell vars to entity defaults.
    const EntityDef* def = g_entityRegistry.get(static_cast<int>(type));
    for (int s = 0; s < 4; ++s)
        g_grid.vars_read[i * 4 + s] = def ? def->getVarDefault(s) : 0;
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

/** Fire OnClick rules for the cell at (x, y). Called when user clicks in navigate mode. */
EMSCRIPTEN_KEEPALIVE
void engine_send_click(int x, int y) {
    processClickAt(x, y);
}

/** Set or release a direction button. key: 0=up, 1=down, 2=left, 3=right. */
EMSCRIPTEN_KEEPALIVE
void engine_set_button_state(int key, int isDown) {
    setButtonState(key, isDown != 0);
}

/** Returns the current game score. */
EMSCRIPTEN_KEEPALIVE
int engine_get_score() {
    return getScore();
}

/**
 * Returns the current game state:
 *   0 = idle (no active game)
 *   1 = active (game in progress)
 *   2 = ended (game over — UI should show end screen)
 */
EMSCRIPTEN_KEEPALIVE
int engine_get_game_state() {
    return getGameState();
}

/** Reset score to 0 and game state to idle. */
EMSCRIPTEN_KEEPALIVE
void engine_reset_game() {
    resetGame();
}

/**
 * Returns a pointer to a static 256×4 RGBA byte table built from the current
 * entity registry.  Re-populated on every call so it always reflects the latest
 * colours, including any changes made by SetColor actions.
 * JS wraps this as: new Uint8Array(mod.HEAPU8.buffer, ptr, 256 * 4)
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* engine_get_color_table() {
    static uint8_t table[256 * 4] = {};
    fillColorTable(table);
    return table;
}

} // extern "C"
