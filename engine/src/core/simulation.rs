use crate::core::grid::Grid;
use crate::core::rule::{eval_condition, exec_action, Rule, Trigger};
use crate::math::rng::Rng;

/// Runs one simulation tick over the entire grid using the data-driven rule set.
/// Processes rows bottom-to-top so gravity propagates naturally in one pass.
/// Columns alternate left-to-right and right-to-left each tick to prevent bias.
pub fn tick(grid: &mut Grid, rules: &[Vec<Rule>], rng: &mut Rng, tick_count: u64) {
    grid.clear_updated();

    let w = grid.width;
    let h = grid.height;
    let left_to_right = tick_count % 2 == 0;

    for raw_y in 0..h {
        let y = h - 1 - raw_y; // bottom-to-top

        let col_iter: Vec<usize> = if left_to_right {
            (0..w).collect()
        } else {
            (0..w).rev().collect()
        };

        for x in col_iter {
            if grid.was_updated(x, y) {
                continue;
            }

            let entity_id = grid.get(x, y) as usize;
            if entity_id == 0 || entity_id >= rules.len() {
                continue; // skip Empty and unregistered ids
            }

            let mut acted = false;
            let rule_count = rules[entity_id].len();

            for rule_idx in 0..rule_count {
                let rule = &rules[entity_id][rule_idx];

                if !matches!(rule.trigger, Trigger::OnTick) {
                    continue;
                }

                let passes = match &rule.condition {
                    Some(cond) => eval_condition(cond, grid, rng, x, y),
                    None => true,
                };

                if passes {
                    let action_count = rules[entity_id][rule_idx].actions.len();
                    for action_idx in 0..action_count {
                        // Safety: we clone the action to release the shared borrow on `rules`
                        // before we mutably borrow `grid` in exec_action.
                        let action = rules[entity_id][rule_idx].actions[action_idx].clone();
                        if exec_action(&action, grid, x, y) {
                            acted = true;
                            break;
                        }
                    }
                    if acted {
                        break; // stop processing further rules for this pixel
                    }
                }
            }

            if acted {
                grid.mark_updated(x, y);
            }
        }
    }
}
