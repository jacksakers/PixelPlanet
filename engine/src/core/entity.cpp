#include "entity.hpp"

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

float EntityRegistry::getDensity(int id) const {
    const EntityDef* def = get(id);
    return def ? def->density : 0.0f;
}

int EntityDef::getVarSlot(const std::string& varName) const {
    for (const auto& v : variables)
        if (v.name == varName) return v.slot;
    return -1;
}

uint16_t EntityDef::getVarDefault(int slot) const {
    for (const auto& v : variables)
        if (v.slot == slot) return v.defaultVal;
    return 0;
}

} // namespace pp
