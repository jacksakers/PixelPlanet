#include "entity.hpp"
#include "grid.hpp"

namespace pp {

EntityRegistry g_entityRegistry;

void EntityRegistry::clear() {
    entities_.clear();
}

void EntityRegistry::registerEntity(const EntityDef& def) {
    entities_[def.id] = def;
}

const EntityDef* EntityRegistry::get(int id) const {
    auto it = entities_.find(id);
    return it != entities_.end() ? &it->second : nullptr;
}

int EntityRegistry::getByName(const std::string& name) const {
    for (const auto& kv : entities_)
        if (kv.second.name == name) return kv.first;
    return -1;
}

float EntityRegistry::getDensity(int id) const {
    const EntityDef* def = get(id);
    return def ? def->density : 0.0f;
}

int EntityDef::getVarSlot(const std::string& varName) const {
    if (varName == "life") return LIFE_VAR_SLOT;  // built-in reserved slot
    for (const auto& v : variables)
        if (v.name == varName) return v.slot;
    return -1;
}

uint16_t EntityDef::getVarDefault(int slot) const {
    if (slot == LIFE_VAR_SLOT) return lifespan;  // built-in life slot
    for (const auto& v : variables)
        if (v.slot == slot) return v.defaultVal;
    return 0;
}

} // namespace pp
