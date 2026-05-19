#pragma once
#include <cstdlib>
#include <cstring>
#include <cstdint>

namespace pp {

// ---------------------------------------------------------------------------
// Per-cell variable slots.
//   Slots 0–3  : user-defined variables (mapped by EntityDef::variables, max 4).
//   Slot  4    : reserved for the built-in 'life' counter (EntityDef::lifespan).
// ---------------------------------------------------------------------------
static constexpr int NUM_VARS_PER_CELL = 5;
static constexpr int LIFE_VAR_SLOT     = 4;  // index of the built-in life counter

// ---------------------------------------------------------------------------
// Grid — double-buffered flat 1D array of cell IDs + per-cell state vars.
// read  = source for the current tick (what the renderer sees).
// write = destination that the evaluator writes into.
// At the end of each tick buffers are swapped via pointer swap (O(1)).
// ---------------------------------------------------------------------------
struct Grid {
    int      w     = 0;
    int      h     = 0;
    int      size  = 0;
    uint8_t*  read       = nullptr;
    uint8_t*  write      = nullptr;
    bool*     dirty      = nullptr;   // tracks cells already moved this tick
    uint16_t* vars_read  = nullptr;   // [idx * NUM_VARS_PER_CELL + slot]
    uint16_t* vars_write = nullptr;

    void allocate(int w, int h);
    void release();

    inline int  idx(int x, int y)    const { return y * w + x; }
    inline bool valid(int x, int y)  const { return x >= 0 && x < w && y >= 0 && y < h; }

    inline uint16_t getVar(int cellIdx, int slot) const {
        return vars_read[cellIdx * NUM_VARS_PER_CELL + slot];
    }
    inline void setVar(int cellIdx, int slot, uint16_t val) {
        vars_write[cellIdx * NUM_VARS_PER_CELL + slot] = val;
    }

    // Move cell (sx,sy) → (dx,dy) in the write buffer and mark destination dirty.
    inline void moveTo(int sx, int sy, int dx, int dy) {
        int si = idx(sx, sy), di = idx(dx, dy);
        write[di] = write[si];
        write[si] = 0u;  // EMPTY_ID
        // Move vars alongside the cell.
        for (int s = 0; s < NUM_VARS_PER_CELL; ++s) {
            vars_write[di * NUM_VARS_PER_CELL + s] = vars_write[si * NUM_VARS_PER_CELL + s];
            vars_write[si * NUM_VARS_PER_CELL + s] = 0;
        }
        dirty[di] = true;
    }

    // O(1) pointer swap — no data copy needed.
    inline void swapBuffers() {
        uint8_t*  tmp  = read;  read  = write;  write = tmp;
        uint16_t* tmpv = vars_read; vars_read = vars_write; vars_write = tmpv;
    }
};

extern Grid g_grid;

} // namespace pp
