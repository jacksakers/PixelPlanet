/// Deterministic seeded RNG using a xorshift32 algorithm.
/// Using a seeded RNG ensures simulation is reproducible from a save file.
pub struct Rng {
    state: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        // Seed must be non-zero for xorshift to work
        let state = if seed == 0 { 2463534242 } else { seed };
        Self { state }
    }

    /// Returns the next pseudo-random u32.
    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.state = x;
        x
    }

    /// Returns a float in [0.0, 1.0).
    pub fn next_f32(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 / 16777216.0
    }

    /// Returns true with the given probability (0.0–1.0).
    pub fn chance(&mut self, probability: f32) -> bool {
        self.next_f32() < probability
    }

    /// Returns a random i32 in [-1, 1] — useful for lateral sand drift.
    pub fn next_dir(&mut self) -> i32 {
        ((self.next_u32() % 3) as i32) - 1
    }
}
