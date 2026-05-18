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
  { id: 1, name: 'Sand',  color: [220, 180,  60, 255], density: 2.0, isStatic: false, variables: [] },
  { id: 2, name: 'Water', color: [ 30, 100, 220, 200], density: 1.0, isStatic: false, variables: [] },
  { id: 3, name: 'Stone', color: [120, 120, 130, 255], density: 0.0, isStatic: true,  variables: [] },
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

// ---------------------------------------------------------------------------
// LocalStorage key
// ---------------------------------------------------------------------------
export const STORAGE_KEY = 'pixelplanet_config_v1';

// ---------------------------------------------------------------------------
// Load / save helpers
// ---------------------------------------------------------------------------
export function saveToStorage(entities, globalRules, entityRules) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entities, globalRules, entityRules }));
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

export const DIRECTIONS = [
  'up', 'down', 'left', 'right',
  'up-left', 'up-right', 'down-left', 'down-right',
];

export const CONDITION_TYPES = [
  'Always', 'NeighborCheck', 'PropertyCheck', 'VariableCheck',
  'NeighborCount', 'Chance', 'AND', 'OR', 'NOT',
];

export const ACTION_TYPES = [
  'Move', 'MoveFirst', 'Transform', 'Spawn', 'Destroy', 'ModifyVariable',
];

export const PROPERTY_OPS = ['<', '<=', '==', '!=', '>', '>='];
export const BUILT_IN_PROPS = ['density'];
export const TRIGGERS = ['OnTick', 'OnRandomTick'];

export const MODIFY_OPS = [
  { value: '+=',  label: 'Add (+)' },
  { value: '-=',  label: 'Subtract (-)' },
  { value: '*=',  label: 'Multiply (×)' },
  { value: 'set', label: 'Set (=)' },
];
