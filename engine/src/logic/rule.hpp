#pragma once
#include <string>
#include <vector>
#include <utility>
#include "../core/types.hpp"

namespace pp {

// ---------------------------------------------------------------------------
// Condition — recursive boolean expression tree.
// The tree is evaluated depth-first at rule-check time.
// ---------------------------------------------------------------------------
struct Condition {
    ConditionType type = COND_ALWAYS;

    // COND_NEIGHBOR
    Dir neighborDir    = DIR_DOWN;
    int neighborTarget = TARGET_EMPTY;  // TARGET_EMPTY | TARGET_ANY | entity ID

    // COND_PROPERTY
    std::string propName;  // "density" | future custom variable names
    std::string propOp;    // "<" | "<=" | "==" | "!=" | ">" | ">="
    float       propVal = 0.0f;

    // COND_CHANCE  (0–100)
    float chance = 100.0f;

    // COND_AND | COND_OR | COND_NOT
    std::vector<Condition> children;
};

// ---------------------------------------------------------------------------
// Action — a single mutation performed on the simulation grid.
// ---------------------------------------------------------------------------
struct Action {
    ActionType type = ACTION_MOVE;

    // ACTION_MOVE
    Dir dir = DIR_DOWN;

    // ACTION_MOVE_FIRST — try each direction in order (randomized if flag set)
    std::vector<Dir> dirs;
    bool randomizeDirs = true;

    // ACTION_TRANSFORM | ACTION_SPAWN
    int targetEntityId = 0;

    // ACTION_SPAWN — direction to place the new cell
    Dir spawnDir = DIR_UP;

    // Phase 3: ACTION_MODIFY_PROPERTY fields go here
};

// ---------------------------------------------------------------------------
// Rule — a single trigger + condition + action list.
// ---------------------------------------------------------------------------
struct Rule {
    std::string id;
    TriggerType trigger            = TRIGGER_ON_TICK;
    int         randomTickInterval = 60;  // used only for TRIGGER_ON_RANDOM_TICK
    Condition   condition;
    std::vector<Action> actions;
};

// ---------------------------------------------------------------------------
// RuleSet — the complete set of global and entity-specific rules.
// Loaded once per config change and queried every tick.
// ---------------------------------------------------------------------------
struct RuleSet {
    std::vector<Rule> globalRules;
    // Entity rules stored as flat (entityId, Rule) pairs.
    // Flat layout keeps cache pressure low for small rule counts.
    std::vector<std::pair<int, Rule>> entityRules;

    void clear();

    // Returns pointers to all rules registered for entityId (in order).
    std::vector<const Rule*> getForEntity(int entityId) const;
};

extern RuleSet g_ruleSet;

} // namespace pp
