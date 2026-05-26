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
    DIR_ANY        = 8,  // sentinel: try all 8 directions in random order
};

// dx / dy offsets for each Dir value (index matches Dir enum).
inline constexpr int DIR_DX[8] = {  0,  0, -1,  1, -1,  1, -1,  1 };
inline constexpr int DIR_DY[8] = { -1,  1,  0,  0, -1, -1,  1,  1 };

// ---------------------------------------------------------------------------
// Rule triggers
// ---------------------------------------------------------------------------
enum TriggerType : int {
    TRIGGER_ON_TICK          = 0,
    TRIGGER_ON_RANDOM_TICK   = 1,
    TRIGGER_ON_CLICK         = 2,   // fires when user interacts with the cell (navigate mode)
    TRIGGER_ON_BUTTON_PRESS  = 3,   // fires every tick while a direction key/button is held
};

// Button key indices (for TRIGGER_ON_BUTTON_PRESS)
static constexpr int BUTTON_UP    = 0;
static constexpr int BUTTON_DOWN  = 1;
static constexpr int BUTTON_LEFT  = 2;
static constexpr int BUTTON_RIGHT = 3;

// ---------------------------------------------------------------------------
// Condition types
// ---------------------------------------------------------------------------
enum ConditionType : int {
    COND_ALWAYS        = 0,  // Always true
    COND_NEIGHBOR      = 1,  // Check neighbouring cell type
    COND_PROPERTY      = 2,  // Check entity built-in property (density)
    COND_CHANCE        = 3,  // Random probability gate
    COND_AND           = 4,  // All children must pass
    COND_OR            = 5,  // Any child must pass
    COND_NOT           = 6,  // Invert single child
    COND_VARIABLE      = 7,  // Check per-cell variable (Phase 3)
    COND_NEIGHBOR_COUNT = 8, // Count matching neighbours (Phase 3)
};

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------
enum ActionType : int {
    ACTION_MOVE            = 0,  // Move to one direction if EMPTY
    ACTION_MOVE_FIRST      = 1,  // Try each dir in list; move to first EMPTY
    ACTION_TRANSFORM       = 2,  // Replace self with another entity type
    ACTION_SPAWN           = 3,  // Create a new cell in a neighbouring slot
    ACTION_DESTROY         = 4,  // Remove self (set to EMPTY)
    ACTION_MODIFY_VARIABLE = 5,  // Mutate a per-cell variable (Phase 3)
    ACTION_EAT             = 6,  // Move into neighbour of target type, consuming it
    ACTION_EAT_FIRST       = 7,  // Try each dir; eat first matching target
    ACTION_SWAP            = 8,  // Swap positions with a neighbour of target type
    ACTION_SWAP_FIRST      = 9,  // Try each dir; swap with first matching target
    ACTION_MOVE_TOWARD     = 10, // Scan surroundings; move one step toward nearest matching cell
    ACTION_MOVE_AWAY       = 11, // Scan surroundings; move one step away from nearest matching cell
    ACTION_ADD_SCORE       = 12, // Add a value to the global score counter
    ACTION_SET_SCORE       = 13, // Set the global score counter to a fixed value
    ACTION_START_GAME      = 14, // Reset score to 0 and mark game as active
    ACTION_END_GAME        = 15, // Mark game as ended (triggers end-screen in UI)
};

// ---------------------------------------------------------------------------
// Special target IDs used in NeighborCheck
// ---------------------------------------------------------------------------
static constexpr int TARGET_EMPTY = -1;  // cell must be EMPTY
static constexpr int TARGET_ANY   = -2;  // cell must be non-EMPTY

} // namespace pp
