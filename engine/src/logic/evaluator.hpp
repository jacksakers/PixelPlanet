#pragma once
#include <cstdint>

namespace pp {

// Advance the simulation one tick using the loaded entity registry + rule set.
void evaluateTick();

// Fire OnClick rules for the cell at (x, y) immediately.
// Called by engine_send_click when the user interacts with the canvas in navigate mode.
void processClickAt(int x, int y);

// Set or release a direction button (key: 0=up, 1=down, 2=left, 3=right).
// OnButtonPress rules fire every tick while the button is held.
void setButtonState(int key, bool pressed);

// Score / game-state accessors (called from JS via exported C functions).
int  getScore();
int  getGameState();  // 0=idle, 1=active, 2=ended
void resetGame();

} // namespace pp
