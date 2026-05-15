use serde::Deserialize;

/// A data-driven pixel type. All entity definitions are loaded at runtime
/// from JSON — the engine never hard-codes "Sand" or "Water".
#[derive(Deserialize, Clone)]
pub struct EntityDef {
    /// Unique identifier 1-255. 0 is reserved for Empty.
    pub id: u8,
    pub name: String,
    /// RGBA color, each channel 0-255.
    pub color: [u8; 4],
    /// Higher density sinks below lower density (used by rule conditions).
    pub density: f32,
}
