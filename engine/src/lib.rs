mod core;
mod math;

use wasm_bindgen::prelude::*;

use crate::core::entity::EntityDef;
use crate::core::grid::Grid;
use crate::core::rule::Rule;
use crate::core::simulation::tick;
use crate::math::rng::Rng;

/// Number of possible entity IDs (u8 range + 1).
const MAX_IDS: usize = 256;

/// The top-level simulation object exposed to JavaScript.
///
/// Phase 2 — Data-driven engine:
/// All entity types and rules are injected at runtime via `register_entity`
/// and `register_rule`. The engine itself has no knowledge of "Sand" or "Water".
#[wasm_bindgen]
pub struct Universe {
    grid: Grid,
    rng: Rng,
    tick_count: u64,
    rgba_buf: Vec<u8>,
    /// `rules[id]` holds all OnTick rules registered for entity `id`.
    rules: Vec<Vec<Rule>>,
    /// RGBA color lookup table indexed by entity id.
    color_table: [[u8; 4]; MAX_IDS],
}

#[wasm_bindgen]
impl Universe {
    /// Create a new Universe with a given width, height, and RNG seed.
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32, seed: u32) -> Universe {
        let w = width as usize;
        let h = height as usize;

        let mut color_table = [[0u8; 4]; MAX_IDS];
        color_table[0] = [15, 15, 20, 255]; // id 0 = Empty (dark background)

        Universe {
            grid: Grid::new(w, h),
            rng: Rng::new(seed),
            tick_count: 0,
            rgba_buf: vec![0u8; w * h * 4],
            rules: vec![Vec::new(); MAX_IDS],
            color_table,
        }
    }

    /// Advance the simulation by one tick.
    pub fn tick(&mut self) {
        tick(&mut self.grid, &self.rules, &mut self.rng, self.tick_count);
        self.tick_count += 1;
    }

    /// Write the current frame as RGBA pixels and return a pointer to the
    /// internal buffer. JavaScript reads this via a Uint8ClampedArray view.
    pub fn render(&mut self) -> *const u8 {
        self.grid.write_rgba(&mut self.rgba_buf, &self.color_table);
        self.rgba_buf.as_ptr()
    }

    /// Return the byte length of the RGBA buffer (width * height * 4).
    pub fn buffer_len(&self) -> u32 {
        self.rgba_buf.len() as u32
    }

    pub fn width(&self) -> u32 {
        self.grid.width as u32
    }

    pub fn height(&self) -> u32 {
        self.grid.height as u32
    }

    /// Paint pixels in a circle of the given radius with the given entity id.
    /// id: 0 = Erase, any registered id paints that entity.
    pub fn paint(&mut self, cx: i32, cy: i32, radius: i32, pixel_id: u8) {
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                if dx * dx + dy * dy <= radius * radius {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if self.grid.in_bounds(nx, ny) {
                        self.grid.set(nx as usize, ny as usize, pixel_id);
                    }
                }
            }
        }
    }

    /// Register an entity definition from a JSON string.
    ///
    /// JSON schema:
    /// ```json
    /// { "id": 1, "name": "Sand", "color": [194, 178, 128, 255], "density": 1.5 }
    /// ```
    /// Entity id 0 is reserved for Empty and cannot be overwritten.
    pub fn register_entity(&mut self, json: &str) -> Result<(), JsValue> {
        let entity: EntityDef = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("register_entity: {e}")))?;
        if entity.id == 0 {
            return Err(JsValue::from_str("Entity id 0 is reserved for Empty"));
        }
        self.color_table[entity.id as usize] = entity.color;
        Ok(())
    }

    /// Register a rule from a JSON string.
    ///
    /// JSON schema:
    /// ```json
    /// {
    ///   "entity_id": 1,
    ///   "trigger": "OnTick",
    ///   "condition": { "type": "NeighborCheck", "dir": "Down", "target_id": 0 },
    ///   "actions":   [{ "type": "Swap", "dir": "Down" }]
    /// }
    /// ```
    /// `condition` may be `null` to fire unconditionally.
    pub fn register_rule(&mut self, json: &str) -> Result<(), JsValue> {
        let rule: Rule = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("register_rule: {e}")))?;
        let eid = rule.entity_id as usize;
        if eid >= MAX_IDS {
            return Err(JsValue::from_str("entity_id out of range (0-255)"));
        }
        self.rules[eid].push(rule);
        Ok(())
    }

    /// Remove all registered entities (colours) and rules, keeping only Empty.
    pub fn clear_registry(&mut self) {
        for rules in &mut self.rules {
            rules.clear();
        }
        self.color_table = [[0u8; 4]; MAX_IDS];
        self.color_table[0] = [15, 15, 20, 255];
    }

    /// Return the current tick counter.
    pub fn tick_count(&self) -> u64 {
        self.tick_count
    }
}
