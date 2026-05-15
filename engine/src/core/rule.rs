use serde::Deserialize;

use crate::core::grid::Grid;
use crate::math::rng::Rng;

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

#[derive(Deserialize, Clone, Copy, Debug)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
    UpLeft,
    UpRight,
    DownLeft,
    DownRight,
}

impl Direction {
    #[inline]
    pub fn offset(self) -> (i32, i32) {
        match self {
            Self::Up        => (0, -1),
            Self::Down      => (0,  1),
            Self::Left      => (-1, 0),
            Self::Right     => ( 1, 0),
            Self::UpLeft    => (-1, -1),
            Self::UpRight   => ( 1, -1),
            Self::DownLeft  => (-1,  1),
            Self::DownRight => ( 1,  1),
        }
    }
}

// ---------------------------------------------------------------------------
// Condition AST
// ---------------------------------------------------------------------------

/// A boolean expression evaluated before an action fires.
#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum Condition {
    /// True when a neighbour in the given direction has the given entity id.
    NeighborCheck { dir: Direction, target_id: u8 },
    /// True with the given probability each time it is evaluated.
    Chance { probability: f32 },
    /// True when ALL child conditions are true (short-circuits).
    And { checks: Vec<Condition> },
    /// True when ANY child condition is true (short-circuits).
    Or  { checks: Vec<Condition> },
    /// Inverts the child condition.
    Not { check: Box<Condition> },
}

// ---------------------------------------------------------------------------
// Action AST
// ---------------------------------------------------------------------------

#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum Action {
    /// Swap this pixel with the neighbour in the given direction.
    Swap { dir: Direction },
    /// Replace this pixel with a different entity type.
    Transform { target_id: u8 },
    /// Delete this pixel (replace with Empty / id 0).
    Destroy,
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

#[derive(Deserialize, Clone, Debug)]
pub enum Trigger {
    OnTick,
}

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/// A complete data-driven behaviour unit attached to one entity type.
#[derive(Deserialize, Clone, Debug)]
pub struct Rule {
    /// Which entity this rule applies to.
    pub entity_id: u8,
    pub trigger: Trigger,
    /// If `None`, the rule fires unconditionally.
    pub condition: Option<Condition>,
    pub actions: Vec<Action>,
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/// Evaluate a condition against the current grid state.
/// Returns `true` if the condition passes for the pixel at (x, y).
pub fn eval_condition(cond: &Condition, grid: &Grid, rng: &mut Rng, x: usize, y: usize) -> bool {
    match cond {
        Condition::NeighborCheck { dir, target_id } => {
            let (dx, dy) = dir.offset();
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;
            grid.in_bounds(nx, ny) && grid.get(nx as usize, ny as usize) == *target_id
        }
        Condition::Chance { probability } => rng.chance(*probability),
        Condition::And { checks } => {
            for c in checks {
                if !eval_condition(c, grid, rng, x, y) {
                    return false;
                }
            }
            true
        }
        Condition::Or { checks } => {
            for c in checks {
                if eval_condition(c, grid, rng, x, y) {
                    return true;
                }
            }
            false
        }
        Condition::Not { check } => !eval_condition(check, grid, rng, x, y),
    }
}

/// Execute a single action.  Returns `true` if it successfully mutated the
/// grid (so rule processing for this pixel can stop).
pub fn exec_action(action: &Action, grid: &mut Grid, x: usize, y: usize) -> bool {
    match action {
        Action::Swap { dir } => {
            let (dx, dy) = dir.offset();
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;
            if !grid.in_bounds(nx, ny) {
                return false;
            }
            let nx = nx as usize;
            let ny = ny as usize;
            grid.swap(x, y, nx, ny);
            grid.mark_updated(nx, ny);
            true
        }
        Action::Transform { target_id } => {
            grid.set(x, y, *target_id);
            true
        }
        Action::Destroy => {
            grid.set(x, y, 0); // 0 = Empty
            true
        }
    }
}
