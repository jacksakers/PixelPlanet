#pragma once
#include <cstdlib>
#include <cstring>
#include <cstdint>

namespace pp {

// ---------------------------------------------------------------------------
// Grid — double-buffered flat 1D array of cell IDs.
// read  = source for the current tick (what the renderer sees).
// write = destination that the evaluator writes into.
// At the end of each tick buffers are swapped via pointer swap (O(1)).
// ---------------------------------------------------------------------------
struct Grid {
    int      w     = 0;
    int      h     = 0;
    int      size  = 0;
    uint8_t* read  = nullptr;
    uint8_t* write = nullptr;
    bool*    dirty = nullptr;  // tracks cells already moved this tick

    void allocate(int w, int h);
    void release();

    inline int  idx(int x, int y)    const { return y * w + x; }
    inline bool valid(int x, int y)  const { return x >= 0 && x < w && y >= 0 && y < h; }

    // Move cell (sx,sy) → (dx,dy) in the write buffer and mark destination dirty.
    inline void moveTo(int sx, int sy, int dx, int dy) {
        int si = idx(sx, sy), di = idx(dx, dy);
        write[di] = write[si];
        write[si] = 0u;  // EMPTY_ID
        dirty[di] = true;
    }

    // O(1) pointer swap — no data copy needed.
    inline void swapBuffers() {
        uint8_t* tmp = read;
        read         = write;
        write        = tmp;
    }
};

extern Grid g_grid;

} // namespace pp
