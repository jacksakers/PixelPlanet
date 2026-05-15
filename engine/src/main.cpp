/**
 * PixelPlanet - Phase 1 Engine
 *
 * Flat 1-D grid compiled to WebAssembly via Emscripten.
 * Implements a hard-coded "falling sand/water/stone" simulation
 * using double-buffering to prove the WASM ↔ JS pipeline runs at 60 FPS.
 *
 * Exported symbols (prefixed _  in JS):
 *   engine_init(w, h)          - allocate grid
 *   engine_get_cells()         - pointer to current read buffer
 *   engine_set_pixel(x, y, t)  - paint a single cell
 *   engine_update()            - advance simulation one tick
 */

#include <emscripten.h>
#include <cstdint>
#include <cstdlib>
#include <cstring>

// ---------------------------------------------------------------------------
// Pixel type constants
// ---------------------------------------------------------------------------
static constexpr uint8_t EMPTY = 0;
static constexpr uint8_t SAND  = 1;
static constexpr uint8_t WATER = 2;
static constexpr uint8_t STONE = 3;

// ---------------------------------------------------------------------------
// Grid state
// ---------------------------------------------------------------------------
static int      g_w     = 0;
static int      g_h     = 0;
static int      g_size  = 0;

static uint8_t* g_read  = nullptr;  // current-tick source
static uint8_t* g_write = nullptr;  // current-tick destination
static bool*    g_dirty = nullptr;  // cells already moved this tick

// ---------------------------------------------------------------------------
// Xorshift-32 deterministic RNG (seeded, so saves are reproducible)
// ---------------------------------------------------------------------------
static uint32_t g_seed = 0xDEADBEEFu;

static inline uint32_t rand32() {
    g_seed ^= g_seed << 13;
    g_seed ^= g_seed >> 17;
    g_seed ^= g_seed << 5;
    return g_seed;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
static inline int  at(int x, int y)    { return y * g_w + x; }
static inline bool valid(int x, int y) { return x >= 0 && x < g_w && y >= 0 && y < g_h; }

// Swap two cells in the write buffer and mark the destination dirty.
static inline void move_to(int sx, int sy, int dx, int dy) {
    int si = at(sx, sy), di = at(dx, dy);
    g_write[di] = g_write[si];
    g_write[si] = EMPTY;
    g_dirty[di] = true;
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------
extern "C" {

EMSCRIPTEN_KEEPALIVE
void engine_init(int w, int h) {
    g_w    = w;
    g_h    = h;
    g_size = w * h;

    free(g_read);
    free(g_write);
    free(g_dirty);

    g_read  = static_cast<uint8_t*>(calloc(g_size, sizeof(uint8_t)));
    g_write = static_cast<uint8_t*>(calloc(g_size, sizeof(uint8_t)));
    g_dirty = static_cast<bool*>   (calloc(g_size, sizeof(bool)));
}

/** Returns a direct pointer into WASM linear memory - JS wraps it as Uint8Array. */
EMSCRIPTEN_KEEPALIVE
uint8_t* engine_get_cells() {
    return g_read;
}

EMSCRIPTEN_KEEPALIVE
void engine_set_pixel(int x, int y, uint8_t type) {
    if (valid(x, y)) g_read[at(x, y)] = type;
}

/**
 * Advance the simulation one tick.
 *
 * Algorithm:
 *  1. Copy read → write buffer (base state for this tick).
 *  2. Clear dirty flags.
 *  3. Sweep bottom-up so falling particles cascade naturally.
 *     Each row alternates L→R / R→L using the RNG to remove sweep bias.
 *  4. For each non-empty, non-dirty cell apply the type's movement rules,
 *     checking the *write* buffer for vacancy (avoids double-placement).
 *  5. Swap read/write pointers (O(1) - no copy needed).
 */
EMSCRIPTEN_KEEPALIVE
void engine_update() {
    if (!g_read) return;

    memcpy(g_write, g_read, static_cast<size_t>(g_size));
    memset(g_dirty, 0,      static_cast<size_t>(g_size) * sizeof(bool));

    for (int y = g_h - 2; y >= 0; --y) {
        // Randomise sweep direction per row to avoid left/right bias.
        bool ltr = static_cast<bool>(rand32() & 1u);

        for (int xi = 0; xi < g_w; ++xi) {
            int x = ltr ? xi : (g_w - 1 - xi);
            int i = at(x, y);

            if (g_dirty[i]) continue;
            uint8_t t = g_read[i];
            if (t == EMPTY || t == STONE) continue;

            // ---------------------------------------------------------------
            // SAND - falls down, piles diagonally
            // ---------------------------------------------------------------
            if (t == SAND) {
                // 1. Straight down
                if (g_write[at(x, y + 1)] == EMPTY) {
                    move_to(x, y, x, y + 1);
                    continue;
                }
                // 2. Diagonal down (random left/right priority)
                int d   = (rand32() & 1u) ? 1 : -1;
                int dx1 = x + d, dx2 = x - d;
                if (valid(dx1, y + 1) && g_write[at(dx1, y + 1)] == EMPTY) {
                    move_to(x, y, dx1, y + 1);
                } else if (valid(dx2, y + 1) && g_write[at(dx2, y + 1)] == EMPTY) {
                    move_to(x, y, dx2, y + 1);
                }
            }

            // ---------------------------------------------------------------
            // WATER - falls down, spreads sideways
            // ---------------------------------------------------------------
            else if (t == WATER) {
                // 1. Straight down
                if (g_write[at(x, y + 1)] == EMPTY) {
                    move_to(x, y, x, y + 1);
                    continue;
                }
                int d   = (rand32() & 1u) ? 1 : -1;
                int dx1 = x + d, dx2 = x - d;
                // 2. Diagonal down
                if (valid(dx1, y + 1) && g_write[at(dx1, y + 1)] == EMPTY) {
                    move_to(x, y, dx1, y + 1);
                } else if (valid(dx2, y + 1) && g_write[at(dx2, y + 1)] == EMPTY) {
                    move_to(x, y, dx2, y + 1);
                }
                // 3. Flat sideways (water flows horizontally)
                else if (valid(dx1, y) && g_write[at(dx1, y)] == EMPTY) {
                    move_to(x, y, dx1, y);
                } else if (valid(dx2, y) && g_write[at(dx2, y)] == EMPTY) {
                    move_to(x, y, dx2, y);
                }
            }
        }
    }

    // Swap read/write buffers (O(1) pointer swap, no memcpy needed).
    uint8_t* tmp = g_read;
    g_read       = g_write;
    g_write      = tmp;
}

} // extern "C"
