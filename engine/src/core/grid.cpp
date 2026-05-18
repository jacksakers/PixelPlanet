#include "grid.hpp"

namespace pp {

Grid g_grid;

void Grid::allocate(int _w, int _h) {
    release();
    w    = _w;
    h    = _h;
    size = w * h;
    read      = static_cast<uint8_t*> (calloc(static_cast<size_t>(size), sizeof(uint8_t)));
    write     = static_cast<uint8_t*> (calloc(static_cast<size_t>(size), sizeof(uint8_t)));
    dirty     = static_cast<bool*>    (calloc(static_cast<size_t>(size), sizeof(bool)));
    vars_read  = static_cast<uint16_t*>(calloc(static_cast<size_t>(size) * NUM_VARS_PER_CELL, sizeof(uint16_t)));
    vars_write = static_cast<uint16_t*>(calloc(static_cast<size_t>(size) * NUM_VARS_PER_CELL, sizeof(uint16_t)));
}

void Grid::release() {
    std::free(read);       read       = nullptr;
    std::free(write);      write      = nullptr;
    std::free(dirty);      dirty      = nullptr;
    std::free(vars_read);  vars_read  = nullptr;
    std::free(vars_write); vars_write = nullptr;
    w = h = size = 0;
}

} // namespace pp
