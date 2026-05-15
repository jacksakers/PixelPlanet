/**
 * parser.cpp
 *
 * Converts the JSON config payload produced by the React UI into the in-memory
 * EntityRegistry and RuleSet structures used by the evaluator.
 *
 * JSON schema (top-level):
 * {
 *   "entities":    [ { id, name, color:[r,g,b,a], density, isStatic }, ... ],
 *   "globalRules": [ <Rule>, ... ],
 *   "entityRules": { "<id>": [ <Rule>, ... ], ... }
 * }
 *
 * Rule schema:
 * { "id": "...", "trigger": "OnTick"|"OnRandomTick", "interval": 60,
 *   "condition": <Condition>, "actions": [ <Action>, ... ] }
 *
 * Condition schema:
 * { "type": "Always"|"NeighborCheck"|"PropertyCheck"|"Chance"|"AND"|"OR"|"NOT",
 *   -- NeighborCheck: "dir": "<dir>", "target": "EMPTY"|"ANY"|<entityId>
 *   -- PropertyCheck: "prop": "density", "op": "<|<=|==|!=|>|>=", "val": <number>
 *   -- Chance:        "val": <0-100>
 *   -- AND|OR:        "children": [ <Condition>, ... ]
 *   -- NOT:           "child": <Condition>
 * }
 *
 * Action schema:
 * { "type": "Move"|"MoveFirst"|"Transform"|"Spawn"|"Destroy",
 *   -- Move:      "dir": "<dir>"
 *   -- MoveFirst: "dirs": ["<dir>", ...], "randomize": true
 *   -- Transform: "targetId": <entityId>
 *   -- Spawn:     "targetId": <entityId>, "dir": "<dir>"
 * }
 *
 * Directions: "up"|"down"|"left"|"right"|"up-left"|"up-right"|"down-left"|"down-right"
 */

#include "parser.hpp"
#include "rule.hpp"
#include "../core/entity.hpp"
#include "../core/types.hpp"
#include "../extern/json.hpp"

#include <string>
#include <stdexcept>

namespace pp {

// ---------------------------------------------------------------------------
// Direction string → Dir
// ---------------------------------------------------------------------------
static Dir parseDir(const std::string& s) {
    if (s == "up")          return DIR_UP;
    if (s == "down")        return DIR_DOWN;
    if (s == "left")        return DIR_LEFT;
    if (s == "right")       return DIR_RIGHT;
    if (s == "up-left")     return DIR_UP_LEFT;
    if (s == "up-right")    return DIR_UP_RIGHT;
    if (s == "down-left")   return DIR_DOWN_LEFT;
    if (s == "down-right")  return DIR_DOWN_RIGHT;
    return DIR_DOWN;  // safe fallback
}

// ---------------------------------------------------------------------------
// Condition parsing (recursive)
// ---------------------------------------------------------------------------
static Condition parseCondition(const nlohmann::json& j) {
    Condition c;
    std::string type = j.value("type", "Always");

    if (type == "Always") {
        c.type = COND_ALWAYS;
    }
    else if (type == "NeighborCheck") {
        c.type        = COND_NEIGHBOR;
        c.neighborDir = parseDir(j.value("dir", "down"));

        if (j.contains("target")) {
            const auto& t = j["target"];
            if (t.is_string()) {
                std::string ts = t.get<std::string>();
                if      (ts == "EMPTY") c.neighborTarget = TARGET_EMPTY;
                else if (ts == "ANY")   c.neighborTarget = TARGET_ANY;
                else                    c.neighborTarget = std::stoi(ts);
            } else if (t.is_number_integer()) {
                c.neighborTarget = t.get<int>();
            }
        }
    }
    else if (type == "PropertyCheck") {
        c.type    = COND_PROPERTY;
        c.propName = j.value("prop", "density");
        c.propOp   = j.value("op",  ">");
        c.propVal  = j.value("val", 0.0f);
    }
    else if (type == "Chance") {
        c.type   = COND_CHANCE;
        c.chance = j.value("val", 100.0f);
    }
    else if (type == "AND") {
        c.type = COND_AND;
        if (j.contains("children"))
            for (const auto& child : j["children"])
                c.children.push_back(parseCondition(child));
    }
    else if (type == "OR") {
        c.type = COND_OR;
        if (j.contains("children"))
            for (const auto& child : j["children"])
                c.children.push_back(parseCondition(child));
    }
    else if (type == "NOT") {
        c.type = COND_NOT;
        if (j.contains("child"))
            c.children.push_back(parseCondition(j["child"]));
    }

    return c;
}

// ---------------------------------------------------------------------------
// Action parsing
// ---------------------------------------------------------------------------
static Action parseAction(const nlohmann::json& j) {
    Action a;
    std::string type = j.value("type", "Move");

    if (type == "Move") {
        a.type = ACTION_MOVE;
        a.dir  = parseDir(j.value("dir", "down"));
    }
    else if (type == "MoveFirst") {
        a.type          = ACTION_MOVE_FIRST;
        a.randomizeDirs = j.value("randomize", true);
        if (j.contains("dirs"))
            for (const auto& d : j["dirs"])
                a.dirs.push_back(parseDir(d.get<std::string>()));
    }
    else if (type == "Transform") {
        a.type           = ACTION_TRANSFORM;
        a.targetEntityId = j.value("targetId", 0);
    }
    else if (type == "Spawn") {
        a.type           = ACTION_SPAWN;
        a.targetEntityId = j.value("targetId", 0);
        a.spawnDir       = parseDir(j.value("dir", "up"));
    }
    else if (type == "Destroy") {
        a.type = ACTION_DESTROY;
    }

    return a;
}

// ---------------------------------------------------------------------------
// Rule parsing
// ---------------------------------------------------------------------------
static Rule parseRule(const nlohmann::json& j) {
    Rule r;
    r.id = j.value("id", "");

    std::string trig = j.value("trigger", "OnTick");
    if (trig == "OnRandomTick") {
        r.trigger            = TRIGGER_ON_RANDOM_TICK;
        r.randomTickInterval = j.value("interval", 60);
    }

    r.condition = j.contains("condition")
                  ? parseCondition(j["condition"])
                  : Condition{};   // defaults to COND_ALWAYS

    if (j.contains("actions"))
        for (const auto& a : j["actions"])
            r.actions.push_back(parseAction(a));

    return r;
}

// ---------------------------------------------------------------------------
// Top-level config parse
// ---------------------------------------------------------------------------
bool parseConfig(const char* jsonStr) {
    try {
        auto doc = nlohmann::json::parse(jsonStr);

        // ---- Entities ----
        g_entityRegistry.clear();
        if (doc.contains("entities")) {
            for (const auto& e : doc["entities"]) {
                EntityDef def;
                def.id       = e.value("id",       0);
                def.name     = e.value("name",     "");
                def.density  = e.value("density",  1.0f);
                def.isStatic = e.value("isStatic", false);

                if (e.contains("color") && e["color"].is_array() && e["color"].size() == 4) {
                    def.color[0] = static_cast<uint8_t>(e["color"][0].get<int>());
                    def.color[1] = static_cast<uint8_t>(e["color"][1].get<int>());
                    def.color[2] = static_cast<uint8_t>(e["color"][2].get<int>());
                    def.color[3] = static_cast<uint8_t>(e["color"][3].get<int>());
                }

                g_entityRegistry.registerEntity(def);
            }
        }

        // ---- Rules ----
        g_ruleSet.clear();

        if (doc.contains("globalRules"))
            for (const auto& r : doc["globalRules"])
                g_ruleSet.globalRules.push_back(parseRule(r));

        if (doc.contains("entityRules")) {
            for (auto it = doc["entityRules"].begin(); it != doc["entityRules"].end(); ++it) {
                int entityId = std::stoi(it.key());
                for (const auto& r : it.value())
                    g_ruleSet.entityRules.emplace_back(entityId, parseRule(r));
            }
        }

        return true;
    }
    catch (...) {
        return false;
    }
}

} // namespace pp
