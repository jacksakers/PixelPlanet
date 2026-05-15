#pragma once
#include <cstdint>

namespace pp {

inline uint32_t& rng_state() {
    static uint32_t s = 0xDEADBEEFu;
    return s;
}

inline void rng_seed(uint32_t seed) {
    rng_state() = seed ? seed : 0xDEADBEEFu;
}

// Xorshift-32 — fast, deterministic, sufficient for cellular automata.
inline uint32_t rand32() {
    uint32_t& s = rng_state();
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return s;
}

} // namespace pp
