#include "rule.hpp"

namespace pp {

RuleSet g_ruleSet;

void RuleSet::clear() {
    globalRules.clear();
    entityRules.clear();
}

std::vector<const Rule*> RuleSet::getForEntity(int entityId) const {
    std::vector<const Rule*> out;
    for (const auto& [eid, rule] : entityRules) {
        if (eid == entityId) out.push_back(&rule);
    }
    return out;
}

} // namespace pp
