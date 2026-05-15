/// Pixel IDs used in Phase 1 (hardcoded for the proof-of-concept).
/// Phase 2 will replace these with data-driven entity definitions.
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum PixelId {
    Empty = 0,
    Sand  = 1,
    Water = 2,
    Stone = 3,
}

impl PixelId {
    pub fn from_u8(v: u8) -> Self {
        match v {
            1 => PixelId::Sand,
            2 => PixelId::Water,
            3 => PixelId::Stone,
            _ => PixelId::Empty,
        }
    }

    /// Returns the RGBA color for a pixel, as four u8 values packed into a u32.
    pub fn color(self) -> [u8; 4] {
        match self {
            PixelId::Empty => [15, 15, 20, 255],
            PixelId::Sand  => [194, 178, 128, 255],
            PixelId::Water => [64, 130, 214, 200],
            PixelId::Stone => [120, 120, 130, 255],
        }
    }
}
