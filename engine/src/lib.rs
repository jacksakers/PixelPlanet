mod core;
mod math;

use wasm_bindgen::prelude::*;

use crate::core::grid::Grid;
use crate::core::pixel::PixelId;
use crate::core::simulation::tick;

/// The top-level simulation object exposed to JavaScript.
#[wasm_bindgen]
pub struct Universe {
    grid: Grid,
    tick_count: u64,
    rgba_buf: Vec<u8>,
}

#[wasm_bindgen]
impl Universe {
    /// Create a new Universe with a given width, height, and RNG seed.
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32, seed: u32) -> Universe {
        let w = width as usize;
        let h = height as usize;
        Universe {
            grid: Grid::new(w, h, seed),
            tick_count: 0,
            rgba_buf: vec![0u8; w * h * 4],
        }
    }

    /// Advance the simulation by one tick.
    pub fn tick(&mut self) {
        tick(&mut self.grid, self.tick_count);
        self.tick_count += 1;
    }

    /// Write the current frame as RGBA pixels and return a pointer to the
    /// internal buffer. JavaScript reads this via a Uint8ClampedArray view.
    pub fn render(&mut self) -> *const u8 {
        self.grid.write_rgba(&mut self.rgba_buf);
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

    /// Paint pixels in a circle of the given radius with the given pixel ID.
    /// id: 0=Empty, 1=Sand, 2=Water, 3=Stone
    pub fn paint(&mut self, cx: i32, cy: i32, radius: i32, pixel_id: u8) {
        let id = PixelId::from_u8(pixel_id);
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                if dx * dx + dy * dy <= radius * radius {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if self.grid.in_bounds(nx, ny) {
                        self.grid.set(nx as usize, ny as usize, id);
                    }
                }
            }
        }
    }
}
