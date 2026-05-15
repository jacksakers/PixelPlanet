use crate::core::grid::Grid;
use crate::core::pixel::PixelId;

/// Runs one simulation tick over the entire grid.
/// Processes rows bottom-to-top so gravity propagates naturally in one pass.
/// Columns alternate left-to-right and right-to-left each tick to prevent bias.
pub fn tick(grid: &mut Grid, tick_count: u64) {
    grid.clear_updated();

    let w = grid.width;
    let h = grid.height;
    let left_to_right = tick_count % 2 == 0;

    // Process bottom row first (h-1) up to row 0 — skip the very bottom row
    // as nothing can fall further. We start from h-1 going up.
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

            let cell = grid.get(x, y);

            match cell {
                PixelId::Sand  => step_sand(grid, x, y),
                PixelId::Water => step_water(grid, x, y),
                PixelId::Empty | PixelId::Stone => {}
            }
        }
    }
}

fn step_sand(grid: &mut Grid, x: usize, y: usize) {
    let below_y = y + 1;
    if below_y >= grid.height {
        return; // already at the bottom
    }

    let below = grid.get(x, below_y);

    // Fall straight down into empty space or through water
    if below == PixelId::Empty || below == PixelId::Water {
        grid.swap(x, y, x, below_y);
        grid.mark_updated(x, below_y);
        return;
    }

    // Try diagonal: pick a random side first to avoid left/right bias
    let dir: i32 = if grid.rng.chance(0.5) { -1 } else { 1 };

    for &d in &[dir, -dir] {
        let nx = x as i32 + d;
        if !grid.in_bounds(nx, below_y as i32) {
            continue;
        }
        let nx = nx as usize;
        let diag = grid.get(nx, below_y);
        if diag == PixelId::Empty || diag == PixelId::Water {
            grid.swap(x, y, nx, below_y);
            grid.mark_updated(nx, below_y);
            return;
        }
    }
}

fn step_water(grid: &mut Grid, x: usize, y: usize) {
    let below_y = y + 1;
    let w = grid.width;

    // Fall straight down
    if below_y < grid.height && grid.get(x, below_y) == PixelId::Empty {
        grid.swap(x, y, x, below_y);
        grid.mark_updated(x, below_y);
        return;
    }

    // Spread sideways — try random direction first
    let dir: i32 = if grid.rng.chance(0.5) { -1 } else { 1 };

    for &d in &[dir, -dir] {
        let nx = x as i32 + d;
        if !grid.in_bounds(nx, y as i32) {
            continue;
        }
        let nx = nx as usize;
        if grid.get(nx, y) == PixelId::Empty {
            grid.swap(x, y, nx, y);
            grid.mark_updated(nx, y);
            return;
        }
    }

    // Try diagonal spread (waterfall effect)
    if below_y < grid.height {
        for &d in &[dir, -dir] {
            let nx = x as i32 + d;
            if !grid.in_bounds(nx, below_y as i32) {
                continue;
            }
            let nx = nx as usize;
            if grid.get(nx, below_y) == PixelId::Empty {
                grid.swap(x, y, nx, below_y);
                grid.mark_updated(nx, below_y);
                return;
            }
        }
    }
    let _ = w; // suppress unused warning
}
