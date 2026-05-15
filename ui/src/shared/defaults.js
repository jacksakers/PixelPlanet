/**
 * shared/defaults.js
 *
 * Canonical default config for Phase 2.
 * Sand, Water, and Stone are no longer hardcoded in C++ — they are plain
 * JSON entities and rules passed to the engine at runtime.
 *
 * Physics design:
 *  - A GLOBAL gravity rule fires for any entity with density > 0 if the cell
 *    directly below is empty.  This means new entities automatically fall
 *    unless you set density=0 / isStatic=true.
 *  - Entity-specific rules handle diagonal spreading (sand) and sideways
 *    flow (water) — behaviours that only apply to those types.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Generate a simple unique rule id using a prefix + timestamp fragment. */
export function newRuleId(prefix = 'rule') {
  return `${prefix}_${Date.now().toString(36)}`;
}

/** Return the next unused entity id given an existing entity array. */
export function nextEntityId(entities) {
  const used = new Set(entities.map((e) => e.id));
  for (let i = 1; i <= 254; i++) {
    if (!used.has(i)) return i;
  }
  throw new Error('Maximum entity count (254) reached.');
}

// ---------------------------------------------------------------------------
// Default entities
// ---------------------------------------------------------------------------
export const DEFAULT_ENTITIES = [
  { id: 1, name: 'Sand',  color: [220, 180,  60, 255], density: 2.0, isStatic: false },
  { id: 2, name: 'Water', color: [ 30, 100, 220, 200], density: 1.0, isStatic: false },
  { id: 3, name: 'Stone', color: [120, 120, 130, 255], density: 0.0, isStatic: true  },
];

// ---------------------------------------------------------------------------
// Default global rules
// ---------------------------------------------------------------------------
export const DEFAULT_GLOBAL_RULES = [
  {
    id: 'global_gravity',
    trigger: 'OnTick',
    condition: {
      type: 'AND',
      children: [
        { type: 'PropertyCheck', prop: 'density', op: '>', val: 0 },
        { type: 'NeighborCheck', dir: 'down', target: 'EMPTY' },
      ],
    },
    actions: [{ type: 'Move', dir: 'down' }],
  },
];

// ---------------------------------------------------------------------------
// Default entity-specific rules
// ---------------------------------------------------------------------------
export const DEFAULT_ENTITY_RULES = {
  1: [
    // Sand spreads diagonally downward — global gravity already handles straight down.
    {
      id: 'sand_spread',
      trigger: 'OnTick',
      condition: { type: 'Always' },
      actions: [
        { type: 'MoveFirst', dirs: ['down-left', 'down-right'], randomize: true },
      ],
    },
  ],
  2: [
    // Water spreads diagonally, then sideways.
    {
      id: 'water_spread_diag',
      trigger: 'OnTick',
      condition: { type: 'Always' },
      actions: [
        { type: 'MoveFirst', dirs: ['down-left', 'down-right'], randomize: true },
      ],
    },
    {
      id: 'water_spread_side',
      trigger: 'OnTick',
      condition: { type: 'Always' },
      actions: [
        { type: 'MoveFirst', dirs: ['left', 'right'], randomize: true },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Build the full JSON payload for engine_load_config
// ---------------------------------------------------------------------------
export function buildEngineConfig(entities, globalRules, entityRules) {
  return {
    entities,
    globalRules,
    // Convert numeric keys to string keys as required by the JSON schema.
    entityRules: Object.fromEntries(
      Object.entries(entityRules).map(([k, v]) => [String(k), v]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Blank rule / condition / action templates (used by the Rule Editor)
// ---------------------------------------------------------------------------
export const BLANK_CONDITION = { type: 'Always' };

export const BLANK_RULE = {
  id: '',
  trigger: 'OnTick',
  condition: { type: 'Always' },
  actions: [],
};

export const DIRECTIONS = [
  'up', 'down', 'left', 'right',
  'up-left', 'up-right', 'down-left', 'down-right',
];

export const CONDITION_TYPES = [
  'Always', 'NeighborCheck', 'PropertyCheck', 'Chance', 'AND', 'OR', 'NOT',
];

export const ACTION_TYPES = [
  'Move', 'MoveFirst', 'Transform', 'Spawn', 'Destroy',
];

export const PROPERTY_OPS = ['<', '<=', '==', '!=', '>', '>='];
export const BUILT_IN_PROPS = ['density'];
export const TRIGGERS = ['OnTick', 'OnRandomTick'];
