#pragma once
#include <array>
#include <string>
#include <unordered_map>
#include <vector>
#include <cstdint>

namespace pp {

// ---------------------------------------------------------------------------
// Variable definition — a named slot with a default value.
// Phase 3: entities carry up to NUM_VARS_PER_CELL of these.
// ---------------------------------------------------------------------------
struct VarDef {
    std::string name;
    uint16_t    defaultVal = 0;
    int         slot       = 0;  // index 0..NUM_VARS_PER_CELL-1 (assigned by parser)
};

// ---------------------------------------------------------------------------
// EntityDef — immutable definition loaded from JSON config.
// ---------------------------------------------------------------------------
struct EntityDef {
    int         id       = 0;
    std::string name     = "";
    std::array<uint8_t, 4> color = { 255, 255, 255, 255 };  // RGBA
    float       density  = 1.0f;   // > 0 = participates in gravity
    bool        isStatic = false;  // engine skips rule evaluation entirely
    std::vector<VarDef> variables; // named per-cell variables (max 4)

    // Look up the slot index for a variable name (-1 if not found).
    int getVarSlot(const std::string& name) const;
    uint16_t getVarDefault(int slot) const;
};

// ---------------------------------------------------------------------------
// EntityRegistry — singleton accessed via g_entityRegistry.
// ---------------------------------------------------------------------------
class EntityRegistry {
public:
    void clear();
    void registerEntity(const EntityDef& def);
    const EntityDef* get(int id) const;
    // Returns the entity ID for the given name, or -1 if not found.
    int getByName(const std::string& name) const;
    const std::unordered_map<int, EntityDef>& all() const { return entities_; }
    float getDensity(int id) const;

private:
    std::unordered_map<int, EntityDef> entities_;
};

extern EntityRegistry g_entityRegistry;

} // namespace pp
