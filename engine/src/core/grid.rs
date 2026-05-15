/// The simulation grid — a flat 1D array representing a 2D canvas.
/// Each cell stores a raw entity id (u8). 0 is always Empty.
/// Indexed as: index = y * width + x.
///
/// A separate `updated` buffer tracks which cells were written this tick
/// to prevent a single pixel from being processed twice per frame (double-step).
pub struct Grid {
    pub width: usize,
    pub height: usize,
    cells: Vec<u8>,
    updated: Vec<bool>,
}

impl Grid {
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            cells: vec![0u8; width * height], // 0 = Empty
            updated: vec![false; width * height],
        }
    }

    #[inline]
    pub fn index(&self, x: usize, y: usize) -> usize {
        y * self.width + x
    }

    #[inline]
    pub fn in_bounds(&self, x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && (x as usize) < self.width && (y as usize) < self.height
    }

    #[inline]
    pub fn get(&self, x: usize, y: usize) -> u8 {
        self.cells[self.index(x, y)]
    }

    #[inline]
    pub fn set(&mut self, x: usize, y: usize, id: u8) {
        let i = self.index(x, y);
        self.cells[i] = id;
    }

    #[inline]
    pub fn was_updated(&self, x: usize, y: usize) -> bool {
        self.updated[self.index(x, y)]
    }

    #[inline]
    pub fn mark_updated(&mut self, x: usize, y: usize) {
        let i = self.index(x, y);
        self.updated[i] = true;
    }

    pub fn clear_updated(&mut self) {
        for v in self.updated.iter_mut() {
            *v = false;
        }
    }

    /// Swap the contents of two cells.
    pub fn swap(&mut self, x1: usize, y1: usize, x2: usize, y2: usize) {
        let i1 = self.index(x1, y1);
        let i2 = self.index(x2, y2);
        self.cells.swap(i1, i2);
    }

    /// Write an RGBA pixel buffer for the current grid state.
    /// The output slice must be width * height * 4 bytes long.
    /// Colors are looked up from the provided table indexed by entity id.
    pub fn write_rgba(&self, out: &mut [u8], color_table: &[[u8; 4]; 256]) {
        for (i, cell) in self.cells.iter().enumerate() {
            let color = color_table[*cell as usize];
            let base = i * 4;
            out[base]     = color[0];
            out[base + 1] = color[1];
            out[base + 2] = color[2];
            out[base + 3] = color[3];
        }
    }

    pub fn len(&self) -> usize {
        self.cells.len()
    }
}
