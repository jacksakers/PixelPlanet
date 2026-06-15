/**
 * shared/defaults.js
 *
 * Canonical default config for Phase 2.
 * Sand, Water, and Stone are no longer hardcoded in C++ — they are plain
 * JSON entities and rules passed to the engine at runtime.
 *
 * Physics design:
 *  - A GLOBAL gravity rule fires for any non-static entity if the cell
 *    directly below is empty.  Static entities (isStatic=true) are skipped
 *    entirely by the evaluator, so they never fall regardless of rules.
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
  { id: 1, name: 'Sand',  color: [220, 180,  60, 255], isStatic: false, variables: [] },
  { id: 2, name: 'Water', color: [ 30, 100, 220, 200], isStatic: false, variables: [] },
  { id: 3, name: 'Stone', color: [120, 120, 130, 255], isStatic: true,  variables: [] },
];

// ---------------------------------------------------------------------------
// Default global rules
// ---------------------------------------------------------------------------
export const DEFAULT_GLOBAL_RULES = [
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

// ---------------------------------------------------------------------------
// LocalStorage key
// ---------------------------------------------------------------------------
export const STORAGE_KEY = 'pixelplanet_config_v1';

// ---------------------------------------------------------------------------
// Sprite helpers
// ---------------------------------------------------------------------------

/** Generate a unique sprite id. */
export function newSpriteId() {
  return `sprite_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Create an empty cells array for a W×H sprite. */
export function makeEmptySpriteCells(w, h) {
  return new Array(w * h).fill(0);
}

/**
 * Resize a sprite's cell grid, preserving content in the overlapping area.
 * New cells default to 0 (transparent).
 */
export function resizeSpriteCells(cells, oldW, oldH, newW, newH) {
  const next = makeEmptySpriteCells(newW, newH);
  for (let row = 0; row < Math.min(oldH, newH); row++) {
    for (let col = 0; col < Math.min(oldW, newW); col++) {
      next[row * newW + col] = cells[row * oldW + col];
    }
  }
  return next;
}

/** Default sprites shipped with the app. */
export const DEFAULT_SPRITES = [];

// ---------------------------------------------------------------------------
// Load / save helpers
// ---------------------------------------------------------------------------
export function saveToStorage(entities, globalRules, entityRules, sprites) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entities, globalRules, entityRules, sprites: sprites ?? [] }));
  } catch (_) { /* storage full / unavailable */ }
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic sanity check
    if (!Array.isArray(parsed.entities)) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Import / export  (entity group = entities + their rules bundled together)
// ---------------------------------------------------------------------------
/**
 * Export a subset of entities and their rules as a portable JSON string.
 * @param {Array}  entities    - array of EntityDef objects to include
 * @param {Object} entityRules - full entityRules map (only selected entities exported)
 * @param {Array}  [globalRules] - optional global rules to include
 */
export function exportBundle(entities, entityRules, globalRules = []) {
  const bundle = {
    version: 1,
    entities,
    globalRules,
    entityRules: Object.fromEntries(
      entities.map((e) => [String(e.id), entityRules[e.id] ?? []])
    ),
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Import a bundle JSON string.
 * Returns { entities, globalRules, entityRules } or null on error.
 * Entity IDs are re-mapped to avoid conflicts with the existing entity list.
 */
export function importBundle(jsonStr, existingEntities) {
  try {
    const bundle = JSON.parse(jsonStr);
    if (!Array.isArray(bundle.entities)) return null;

    const usedIds = new Set(existingEntities.map((e) => e.id));
    const idMap   = {};  // old id → new id

    // Assign fresh IDs for any entity that would conflict.
    let nextId = 1;
    const remapped = bundle.entities.map((e) => {
      while (usedIds.has(nextId)) nextId++;
      idMap[e.id] = nextId;
      usedIds.add(nextId);
      return { ...e, id: nextId++, variables: e.variables ?? [] };
    });

    // Remap entity IDs inside rules (targetId fields etc.)
    function remapCondition(c) {
      if (!c) return c;
      const nc = { ...c };
      if (nc.children) nc.children = nc.children.map(remapCondition);
      return nc;
    }
    function remapAction(a) {
      const na = { ...a };
      if (na.targetId != null && idMap[na.targetId] != null)
        na.targetId = idMap[na.targetId];
      return na;
    }
    function remapRule(r) {
      return {
        ...r,
        id: newRuleId(r.id ?? 'rule'),
        condition: remapCondition(r.condition),
        actions: (r.actions ?? []).map(remapAction),
      };
    }

    const entityRules = {};
    for (const e of remapped) {
      const oldId = Object.keys(idMap).find((k) => idMap[k] === e.id);
      const rules = bundle.entityRules?.[String(oldId)] ?? [];
      entityRules[e.id] = rules.map(remapRule);
    }

    const globalRules = (bundle.globalRules ?? []).map(remapRule);

    return { entities: remapped, globalRules, entityRules };
  } catch (_) {
    return null;
  }
}

// Directions used in condition editors (NeighborCheck — 'any' makes no sense here).
export const DIRECTIONS = [
  'up', 'down', 'left', 'right',
  'up-left', 'up-right', 'down-left', 'down-right',
];

// Directions used in action editors — includes 'any' (random empty neighbour).
export const ACTION_DIRECTIONS = [
  ...DIRECTIONS,
  'any',  // tries all 8 dirs in random order; moves/spawns into first valid slot
];

export const CONDITION_TYPES = [
  'Always', 'NeighborCheck', 'VariableCheck',
  'NeighborCount', 'InRange', 'Chance', 'AND', 'OR', 'NOT',
];

export const ACTION_TYPES = [
  'Move', 'MoveFirst', 'Transform', 'Spawn', 'Destroy', 'ModifyVariable',
  'Eat', 'EatFirst', 'Swap', 'SwapFirst', 'MoveToward', 'MoveAway',
  'SetColor', 'Teleport', 'BroadcastEvent',
  'AddScore', 'SetScore', 'StartGame', 'EndGame',
];

export const PROPERTY_OPS = ['<', '<=', '==', '!=', '>', '>='];
export const TRIGGERS = ['OnTick', 'OnRandomTick', 'OnClick', 'OnButtonPress', 'OnTimer', 'OnEvent'];
export const BUTTON_KEYS = ['up', 'down', 'left', 'right'];

export const MODIFY_OPS = [
  { value: '+=',  label: 'Add (+)' },
  { value: '-=',  label: 'Subtract (-)' },
  { value: '*=',  label: 'Multiply (×)' },
  { value: 'set', label: 'Set (=)' },
];

// ---------------------------------------------------------------------------
// Pack storage  (named snapshots of the full simulation config)
// ---------------------------------------------------------------------------
export const PACKS_STORAGE_KEY = 'pixelplanet_packs_v1';

/** Load all saved packs from localStorage. Returns array of pack objects. */
export function loadPacks() {
  try {
    const raw = localStorage.getItem(PACKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Save the current config as a named pack.
 * Returns the new packs array.
 */
export function savePack(name, entities, globalRules, entityRules, sprites) {
  const packs = loadPacks();
  const pack = {
    id:          `pack_${Date.now().toString(36)}`,
    name:        name.trim() || 'Unnamed Pack',
    savedAt:     Date.now(),
    entities,
    globalRules,
    entityRules,
    sprites:     sprites ?? [],
  };
  const next = [pack, ...packs];
  try { localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}

/** Delete a pack by id. Returns the new packs array. */
export function deletePack(id) {
  const next = loadPacks().filter((p) => p.id !== id);
  try { localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}
