#pragma once
#include <cstdint>

namespace pp {

// ---------------------------------------------------------------------------
// Cell constants
// ---------------------------------------------------------------------------
static constexpr uint8_t EMPTY_ID = 0;

// ---------------------------------------------------------------------------
// Directions  (index into DIR_DX / DIR_DY)
// ---------------------------------------------------------------------------
enum Dir : int {
    DIR_UP         = 0,
    DIR_DOWN       = 1,
    DIR_LEFT       = 2,
    DIR_RIGHT      = 3,
    DIR_UP_LEFT    = 4,
    DIR_UP_RIGHT   = 5,
    DIR_DOWN_LEFT  = 6,
    DIR_DOWN_RIGHT = 7,
    DIR_NONE       = -1,
};

// dx / dy offsets for each Dir value (index matches Dir enum).
inline constexpr int DIR_DX[8] = {  0,  0, -1,  1, -1,  1, -1,  1 };
inline constexpr int DIR_DY[8] = { -1,  1,  0,  0, -1, -1,  1,  1 };

// ---------------------------------------------------------------------------
// Rule triggers
// ---------------------------------------------------------------------------
enum TriggerType : int {
    TRIGGER_ON_TICK        = 0,
    TRIGGER_ON_RANDOM_TICK = 1,
    // Phase 3: TRIGGER_ON_SPAWN, TRIGGER_ON_DEATH, TRIGGER_ON_COLLISION
};

// ---------------------------------------------------------------------------
// Condition types
// ---------------------------------------------------------------------------
enum ConditionType : int {
    COND_ALWAYS   = 0,  // Always true
    COND_NEIGHBOR = 1,  // Check neighbouring cell type
    COND_PROPERTY = 2,  // Check entity property (density, custom vars)
    COND_CHANCE   = 3,  // Random probability gate
    COND_AND      = 4,  // All children must pass
    COND_OR       = 5,  // Any child must pass
    COND_NOT      = 6,  // Invert single child
};

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------
enum ActionType : int {
    ACTION_MOVE       = 0,  // Move to one direction if EMPTY
    ACTION_MOVE_FIRST = 1,  // Try each dir in list; move to first EMPTY
    ACTION_TRANSFORM  = 2,  // Replace self with another entity type
    ACTION_SPAWN      = 3,  // Create a new cell in a neighbouring slot
    ACTION_DESTROY    = 4,  // Remove self (set to EMPTY)
    // Phase 3: ACTION_MODIFY_PROPERTY
};

// ---------------------------------------------------------------------------
// Special target IDs used in NeighborCheck
// ---------------------------------------------------------------------------
static constexpr int TARGET_EMPTY = -1;  // cell must be EMPTY
static constexpr int TARGET_ANY   = -2;  // cell must be non-EMPTY

} // namespace pp
