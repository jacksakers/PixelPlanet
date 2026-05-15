#pragma once
#include <array>
#include <string>
#include <unordered_map>
#include <cstdint>

namespace pp {

// ---------------------------------------------------------------------------
// EntityDef — immutable definition loaded from JSON config.
// Phase 2: color, density, isStatic.
// Phase 3: custom properties dictionary.
// ---------------------------------------------------------------------------
struct EntityDef {
    int         id       = 0;
    std::string name     = "";
    std::array<uint8_t, 4> color = { 255, 255, 255, 255 };  // RGBA
    float       density  = 1.0f;   // > 0 = participates in gravity
    bool        isStatic = false;  // engine skips rule evaluation entirely
};

// ---------------------------------------------------------------------------
// EntityRegistry — singleton accessed via g_entityRegistry.
// ---------------------------------------------------------------------------
class EntityRegistry {
public:
    void clear();
    void registerEntity(const EntityDef& def);
    const EntityDef* get(int id) const;
    const std::unordered_map<int, EntityDef>& all() const { return entities_; }
    float getDensity(int id) const;

private:
    std::unordered_map<int, EntityDef> entities_;
};

extern EntityRegistry g_entityRegistry;

} // namespace pp
