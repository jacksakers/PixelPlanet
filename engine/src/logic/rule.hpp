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
    std::string propName;  // "density"
    std::string propOp;    // "<" | "<=" | "==" | "!=" | ">" | ">="
    float       propVal = 0.0f;

    // COND_CHANCE  (0–100)
    float chance = 100.0f;

    // COND_VARIABLE (Phase 3)
    std::string varName;   // name of the entity variable to check
    // re-uses propOp and propVal for comparison

    // COND_NEIGHBOR_COUNT (Phase 3)
    int  countTarget  = -1;   // TARGET_EMPTY / TARGET_ANY / entity ID
    std::string countOp;      // same op set as propOp
    int  countVal     = 0;

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

    // ACTION_MODIFY_VARIABLE (Phase 3)
    std::string modVarName;   // variable name to modify
    std::string modOp;        // "set" | "+=" | "-=" | "*="
    float       modVal = 0.0f;

    // ACTION_EAT / ACTION_EAT_FIRST — move into a cell of eatTarget type, consuming it.
    // dirs / randomizeDirs reused for EatFirst.
    int         eatTarget      = TARGET_ANY;  // TARGET_ANY | entity ID (TARGET_EMPTY not useful here)
    std::string gainVar;                      // optional per-cell variable to increment when eating
    float       gainVal        = 0.0f;        // amount to add to gainVar
    int         eatReplaceWith = TARGET_ANY;  // what to place at the source cell after eating:
                                              //   TARGET_ANY (-2) = leave EMPTY (default)
                                              //   TARGET_EMPTY (-1) = explicitly EMPTY
                                              //   entity ID >= 0  = spawn that entity there

    // ACTION_SWAP / ACTION_SWAP_FIRST — swap positions with a neighbour of swapTarget type.
    // dir / dirs / randomizeDirs reused from above.
    int         swapTarget = TARGET_ANY;  // TARGET_ANY | entity ID

    // ACTION_MOVE_TOWARD / ACTION_MOVE_AWAY — scan surroundings up to senseRange cells;
    // move one step toward (or away from) the nearest cell matching senseTarget.
    int  senseTarget = TARGET_ANY;  // TARGET_EMPTY | TARGET_ANY | entity ID
    int  senseRange  = 5;           // how many cells to scan along each ray (1–32)

    // ACTION_ADD_SCORE / ACTION_SET_SCORE
    float scoreVal = 1.0f;  // value to add or set
};

// ---------------------------------------------------------------------------
// Rule — a single trigger + condition + action list.
// ---------------------------------------------------------------------------
struct Rule {
    std::string id;
    TriggerType trigger            = TRIGGER_ON_TICK;
    int         randomTickInterval = 60;  // used only for TRIGGER_ON_RANDOM_TICK
    int         buttonKey          = 0;   // used only for TRIGGER_ON_BUTTON_PRESS (0=up,1=down,2=left,3=right)
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
