/**
 * evaluator.cpp
 *
 * Main simulation tick loop.  Reads the global rule set and entity-specific
 * rules loaded by the parser and applies them each frame.
 *
 * Evaluation order per cell (x, y):
 *  1. Skip if dirty (already moved this tick) or EMPTY.
 *  2. Skip if entity is marked isStatic.
 *  3. Try global rules in registration order — stop at first rule that
 *     executes at least one successful action.
 *  4. If no global rule fired, try entity-specific rules in order — stop
 *     at first rule that succeeds.
 *
 * Grid read/write discipline:
 *  - Cell identity  → read from g_read (original state this tick).
 *  - Neighbour checks → read from g_write (reflects moves already made
 *    this tick so two pixels cannot occupy the same target cell).
 *  - Mutations        → write to g_write and mark dirty[].
 */

#include "evaluator.hpp"
#include "rule.hpp"
#include "../core/grid.hpp"
#include "../core/entity.hpp"
#include "../core/types.hpp"
#include "../math/rng.hpp"

#include <cstring>

namespace pp {

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

static bool evalCondition(const Condition& c, int x, int y, uint8_t cellId);

static bool evalNeighborCheck(int x, int y, Dir dir, int targetId) {
    int nx = x + DIR_DX[dir];
    int ny = y + DIR_DY[dir];
    if (!g_grid.valid(nx, ny)) return false;
    uint8_t cell = g_grid.write[g_grid.idx(nx, ny)];
    if (targetId == TARGET_EMPTY) return cell == EMPTY_ID;
    if (targetId == TARGET_ANY)   return cell != EMPTY_ID;
    return cell == static_cast<uint8_t>(targetId);
}

static bool evalPropertyCheck(uint8_t cellId, const Condition& c) {
    float val = 0.0f;
    if (c.propName == "density") {
        val = g_entityRegistry.getDensity(static_cast<int>(cellId));
    }

    const auto& op = c.propOp;
    if (op == "<")  return val <  c.propVal;
    if (op == "<=") return val <= c.propVal;
    if (op == "==") return val == c.propVal;
    if (op == "!=") return val != c.propVal;
    if (op == ">")  return val >  c.propVal;
    if (op == ">=") return val >= c.propVal;
    return false;
}

static bool evalVariableCheck(int cellIdx, uint8_t cellId, const Condition& c) {
    const EntityDef* def = g_entityRegistry.get(static_cast<int>(cellId));
    if (!def) return false;
    int slot = def->getVarSlot(c.varName);
    if (slot < 0) return false;
    float val = static_cast<float>(g_grid.getVar(cellIdx, slot));

    const auto& op = c.propOp;
    if (op == "<")  return val <  c.propVal;
    if (op == "<=") return val <= c.propVal;
    if (op == "==") return val == c.propVal;
    if (op == "!=") return val != c.propVal;
    if (op == ">")  return val >  c.propVal;
    if (op == ">=") return val >= c.propVal;
    return false;
}

// Count matching neighbours (8-neighbourhood)
static int countNeighbors(int x, int y, int targetId) {
    int count = 0;
    for (int dir = 0; dir < 8; ++dir) {
        int nx = x + DIR_DX[dir];
        int ny = y + DIR_DY[dir];
        if (!g_grid.valid(nx, ny)) continue;
        uint8_t cell = g_grid.write[g_grid.idx(nx, ny)];
        if (targetId == TARGET_EMPTY && cell == EMPTY_ID)  ++count;
        else if (targetId == TARGET_ANY && cell != EMPTY_ID) ++count;
        else if (targetId >= 0 && cell == static_cast<uint8_t>(targetId)) ++count;
    }
    return count;
}

static bool evalCondition(const Condition& c, int x, int y, uint8_t cellId) {
    switch (c.type) {
        case COND_ALWAYS:
            return true;
        case COND_NEIGHBOR:
            return evalNeighborCheck(x, y, c.neighborDir, c.neighborTarget);
        case COND_PROPERTY:
            return evalPropertyCheck(cellId, c);
        case COND_CHANCE:
            return (rand32() % 100u) < static_cast<uint32_t>(c.chance);
        case COND_AND:
            for (const auto& child : c.children)
                if (!evalCondition(child, x, y, cellId)) return false;
            return true;
        case COND_OR:
            for (const auto& child : c.children)
                if (evalCondition(child, x, y, cellId)) return true;
            return false;
        case COND_NOT:
            return !c.children.empty() && !evalCondition(c.children[0], x, y, cellId);
        case COND_VARIABLE:
            return evalVariableCheck(g_grid.idx(x, y), cellId, c);
        case COND_NEIGHBOR_COUNT: {
            int n = countNeighbors(x, y, c.countTarget);
            const auto& op = c.countOp;
            if (op == "<")  return n <  c.countVal;
            if (op == "<=") return n <= c.countVal;
            if (op == "==") return n == c.countVal;
            if (op == "!=") return n != c.countVal;
            if (op == ">")  return n >  c.countVal;
            if (op == ">=") return n >= c.countVal;
            return false;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

// Try to move the cell at (x,y) to (x+dx, y+dy) if that cell is EMPTY.
static bool tryMove(int x, int y, Dir dir) {
    int nx = x + DIR_DX[dir];
    int ny = y + DIR_DY[dir];
    if (!g_grid.valid(nx, ny)) return false;
    if (g_grid.write[g_grid.idx(nx, ny)] != EMPTY_ID) return false;
    g_grid.moveTo(x, y, nx, ny);
    return true;
}

static bool execMoveFirst(int x, int y, const std::vector<Dir>& dirs, bool randomize) {
    if (dirs.empty()) return false;

    // For exactly two directions randomize which is tried first to remove bias.
    if (randomize && dirs.size() == 2) {
        if (rand32() & 1u) {
            if (tryMove(x, y, dirs[0])) return true;
            return tryMove(x, y, dirs[1]);
        } else {
            if (tryMove(x, y, dirs[1])) return true;
            return tryMove(x, y, dirs[0]);
        }
    }

    for (auto d : dirs)
        if (tryMove(x, y, d)) return true;
    return false;
}

static bool execAction(int x, int y, const Action& a) {
    switch (a.type) {
        case ACTION_MOVE:
            return tryMove(x, y, a.dir);

        case ACTION_MOVE_FIRST:
            return execMoveFirst(x, y, a.dirs, a.randomizeDirs);

        case ACTION_TRANSFORM: {
            int i = g_grid.idx(x, y);
            uint8_t newId = static_cast<uint8_t>(a.targetEntityId);
            g_grid.write[i] = newId;
            // Reinitialise vars to the new entity's defaults.
            const EntityDef* def = g_entityRegistry.get(a.targetEntityId);
            if (def) {
                for (int s = 0; s < NUM_VARS_PER_CELL; ++s)
                    g_grid.vars_write[i * NUM_VARS_PER_CELL + s] = def->getVarDefault(s);
            }
            g_grid.dirty[i] = true;
            return true;
        }

        case ACTION_SPAWN: {
            int nx = x + DIR_DX[a.spawnDir];
            int ny = y + DIR_DY[a.spawnDir];
            if (!g_grid.valid(nx, ny)) return false;
            int di = g_grid.idx(nx, ny);
            if (g_grid.write[di] != EMPTY_ID) return false;
            g_grid.write[di] = static_cast<uint8_t>(a.targetEntityId);
            // Initialise vars to the spawned entity's defaults.
            const EntityDef* def = g_entityRegistry.get(a.targetEntityId);
            if (def) {
                for (int s = 0; s < NUM_VARS_PER_CELL; ++s)
                    g_grid.vars_write[di * NUM_VARS_PER_CELL + s] = def->getVarDefault(s);
            }
            g_grid.dirty[di] = true;
            return true;
        }

        case ACTION_DESTROY: {
            int i = g_grid.idx(x, y);
            g_grid.write[i] = EMPTY_ID;
            for (int s = 0; s < NUM_VARS_PER_CELL; ++s)
                g_grid.vars_write[i * NUM_VARS_PER_CELL + s] = 0;
            g_grid.dirty[i] = true;
            return true;
        }

        case ACTION_MODIFY_VARIABLE: {
            int i = g_grid.idx(x, y);
            uint8_t cellId2 = g_grid.write[i];
            const EntityDef* def = g_entityRegistry.get(static_cast<int>(cellId2));
            if (!def) return false;
            int slot = def->getVarSlot(a.modVarName);
            if (slot < 0) return false;
            float cur = static_cast<float>(g_grid.vars_write[i * NUM_VARS_PER_CELL + slot]);
            float next = cur;
            if      (a.modOp == "+=") next = cur + a.modVal;
            else if (a.modOp == "-=") next = cur - a.modVal;
            else if (a.modOp == "*=") next = cur * a.modVal;
            else                      next = a.modVal;  // "set"
            // Clamp to uint16_t range.
            if (next < 0.0f)      next = 0.0f;
            if (next > 65535.0f)  next = 65535.0f;
            g_grid.vars_write[i * NUM_VARS_PER_CELL + slot] = static_cast<uint16_t>(next);
            return true;
        }

        case ACTION_EAT:
        case ACTION_EAT_FIRST: {
            // Helpers reused for both single-dir and multi-dir variants.
            auto tryEat = [&](Dir edir) -> bool {
                int nx = x + DIR_DX[edir];
                int ny = y + DIR_DY[edir];
                if (!g_grid.valid(nx, ny)) return false;
                int ni = g_grid.idx(nx, ny);
                uint8_t target = g_grid.write[ni];
                // Target check.
                if (a.eatTarget == TARGET_EMPTY) return false; // eating empty makes no sense
                if (a.eatTarget == TARGET_ANY) {
                    if (target == EMPTY_ID) return false;
                } else {
                    if (target != static_cast<uint8_t>(a.eatTarget)) return false;
                }
                // Move self into the target cell (consuming it).
                g_grid.moveTo(x, y, nx, ny);
                // Optional variable gain for the eater.
                if (!a.gainVar.empty() && a.gainVal != 0.0f) {
                    int oi = g_grid.idx(nx, ny); // eater is now at (nx,ny)
                    uint8_t eaterId = g_grid.write[oi];
                    const EntityDef* eDef = g_entityRegistry.get(static_cast<int>(eaterId));
                    if (eDef) {
                        int slot = eDef->getVarSlot(a.gainVar);
                        if (slot >= 0) {
                            float cur  = static_cast<float>(g_grid.vars_write[oi * NUM_VARS_PER_CELL + slot]);
                            float next = cur + a.gainVal;
                            if (next < 0.0f)     next = 0.0f;
                            if (next > 65535.0f) next = 65535.0f;
                            g_grid.vars_write[oi * NUM_VARS_PER_CELL + slot] = static_cast<uint16_t>(next);
                        }
                    }
                }
                return true;
            };

            if (a.type == ACTION_EAT) {
                return tryEat(a.dir);
            } else {
                // EatFirst: try each direction in order (optionally randomised).
                if (a.randomizeDirs && a.dirs.size() == 2) {
                    if (rand32() & 1u) {
                        if (tryEat(a.dirs[0])) return true;
                        return tryEat(a.dirs[1]);
                    } else {
                        if (tryEat(a.dirs[1])) return true;
                        return tryEat(a.dirs[0]);
                    }
                }
                for (auto d : a.dirs)
                    if (tryEat(d)) return true;
                return false;
            }
        }

        case ACTION_SWAP:
        case ACTION_SWAP_FIRST: {
            auto trySwap = [&](Dir sdir) -> bool {
                int nx = x + DIR_DX[sdir];
                int ny = y + DIR_DY[sdir];
                if (!g_grid.valid(nx, ny)) return false;
                int ni = g_grid.idx(nx, ny);
                uint8_t target = g_grid.write[ni];
                // Target check.
                if (a.swapTarget == TARGET_EMPTY) {
                    if (target != EMPTY_ID) return false;
                } else if (a.swapTarget == TARGET_ANY) {
                    if (target == EMPTY_ID) return false;
                } else {
                    if (target != static_cast<uint8_t>(a.swapTarget)) return false;
                }
                // Swap both cells and their variable banks.
                int si = g_grid.idx(x, y);
                std::swap(g_grid.write[si], g_grid.write[ni]);
                g_grid.dirty[si] = true;
                g_grid.dirty[ni] = true;
                for (int s = 0; s < NUM_VARS_PER_CELL; ++s)
                    std::swap(g_grid.vars_write[si * NUM_VARS_PER_CELL + s],
                              g_grid.vars_write[ni * NUM_VARS_PER_CELL + s]);
                return true;
            };

            if (a.type == ACTION_SWAP) {
                return trySwap(a.dir);
            } else {
                if (a.randomizeDirs && a.dirs.size() == 2) {
                    if (rand32() & 1u) {
                        if (trySwap(a.dirs[0])) return true;
                        return trySwap(a.dirs[1]);
                    } else {
                        if (trySwap(a.dirs[1])) return true;
                        return trySwap(a.dirs[0]);
                    }
                }
                for (auto d : a.dirs)
                    if (trySwap(d)) return true;
                return false;
            }
        }
    }
    return false;
}

// Execute a rule: evaluate condition, then run actions.
// Returns true if the rule fired and at least one action succeeded.
// *movedOut (optional) is set to true if a movement action succeeded
// (which means the cell is no longer at (x,y) in the write buffer).
static bool execRule(const Rule& rule, int x, int y, uint8_t cellId, bool* movedOut = nullptr) {
    if (!evalCondition(rule.condition, x, y, cellId)) return false;

    bool anyApplied = false;
    bool didMove    = false;
    for (const auto& action : rule.actions) {
        bool applied = execAction(x, y, action);
        if (applied) {
            anyApplied = true;
            // If a movement action succeeded, the pixel is gone from (x,y).
            if (action.type == ACTION_MOVE || action.type == ACTION_MOVE_FIRST ||
                action.type == ACTION_EAT  || action.type == ACTION_EAT_FIRST  ||
                action.type == ACTION_SWAP || action.type == ACTION_SWAP_FIRST) {
                didMove = true;
                break;
            }
        }
    }
    if (movedOut) *movedOut = didMove;
    return anyApplied;
}

// ---------------------------------------------------------------------------
// Public tick entry point
// ---------------------------------------------------------------------------
void evaluateTick() {
    Grid& g = g_grid;
    if (!g.read) return;

    memcpy(g.write,      g.read,      static_cast<size_t>(g.size));
    memcpy(g.vars_write, g.vars_read, static_cast<size_t>(g.size) * NUM_VARS_PER_CELL * sizeof(uint16_t));
    memset(g.dirty,      0,           static_cast<size_t>(g.size) * sizeof(bool));

    // Sweep bottom-up so gravity cascades naturally in a single pass.
    // Alternate LTR / RTL per row using the RNG to remove sweep bias.
    for (int y = g.h - 2; y >= 0; --y) {
        bool ltr = static_cast<bool>(rand32() & 1u);

        for (int xi = 0; xi < g.w; ++xi) {
            int x = ltr ? xi : (g.w - 1 - xi);
            int i = g.idx(x, y);

            if (g.dirty[i]) continue;
            uint8_t cellId = g.read[i];
            if (cellId == EMPTY_ID) continue;

            // Skip static entities (stone, etc.)
            const EntityDef* def = g_entityRegistry.get(static_cast<int>(cellId));
            if (def && def->isStatic) continue;

            // ------------------------------------------------------------------
            // 1. Global rules — e.g., gravity applies to everything with density > 0
            // ------------------------------------------------------------------
            bool moved = false;
            for (const auto& rule : g_ruleSet.globalRules) {
                if (execRule(rule, x, y, cellId)) { moved = true; break; }
            }

            // ------------------------------------------------------------------
            // 2. Entity-specific rules — diagonal spread, sideways flow, etc.
            // All non-movement rules are allowed to fire in the same tick.
            // We only stop if a movement action moves the cell away.
            // ------------------------------------------------------------------
            if (!moved) {
                for (const auto& [eid, rule] : g_ruleSet.entityRules) {
                    if (eid != static_cast<int>(cellId)) continue;
                    // Stop if a previous rule destroyed this cell.
                    if (g_grid.write[g_grid.idx(x, y)] == EMPTY_ID) break;
                    bool cellMoved = false;
                    execRule(rule, x, y, cellId, &cellMoved);
                    if (cellMoved) break;
                }
            }
        }
    }

    g.swapBuffers();
}

} // namespace pp
