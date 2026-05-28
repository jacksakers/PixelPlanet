/**
 * store/SimContext.jsx
 *
 * React context that owns the entire simulation configuration:
 *   - entities[]
 *   - globalRules[]
 *   - entityRules { [entityId]: Rule[] }
 *
 * Components read state via useSimContext().
 * The context also exposes a pre-built colorTable (Uint8Array, 256 × 4 RGBA
 * bytes) so SimCanvas can do zero-allocation colour lookups each frame.
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useEffect,
} from 'react';import {
  DEFAULT_ENTITIES,
  DEFAULT_GLOBAL_RULES,
  DEFAULT_ENTITY_RULES,
  DEFAULT_SPRITES,
  saveToStorage,
  loadFromStorage,
} from '../shared/defaults.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const SimContext = createContext(null);

// ---------------------------------------------------------------------------
// Initial state — prefer localStorage over hardcoded defaults
// ---------------------------------------------------------------------------
function loadInitialState() {
  const saved = loadFromStorage();
  if (saved) {
    return {
      entities:    saved.entities    ?? DEFAULT_ENTITIES,
      globalRules: saved.globalRules ?? DEFAULT_GLOBAL_RULES,
      entityRules: saved.entityRules ?? DEFAULT_ENTITY_RULES,
      sprites:     saved.sprites     ?? DEFAULT_SPRITES,
    };
  }
  return {
    entities:    DEFAULT_ENTITIES,
    globalRules: DEFAULT_GLOBAL_RULES,
    entityRules: DEFAULT_ENTITY_RULES,
    sprites:     DEFAULT_SPRITES,
  };
}

const initialState = loadInitialState();

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function reducer(state, action) {
  switch (action.type) {

    // ── Entities ────────────────────────────────────────────────────────────
    case 'ENTITY_ADD':
      return { ...state, entities: [...state.entities, action.entity] };

    case 'ENTITY_UPDATE':
      return {
        ...state,
        entities: state.entities.map((e) =>
          e.id === action.entity.id ? { ...e, ...action.entity } : e,
        ),
      };

    case 'ENTITY_DELETE': {
      const nextRules = { ...state.entityRules };
      delete nextRules[action.id];
      return {
        ...state,
        entities:    state.entities.filter((e) => e.id !== action.id),
        entityRules: nextRules,
      };
    }

    // ── Global Rules ────────────────────────────────────────────────────────
    case 'GLOBAL_RULE_ADD':
      return { ...state, globalRules: [...state.globalRules, action.rule] };

    case 'GLOBAL_RULE_UPDATE':
      return {
        ...state,
        globalRules: state.globalRules.map((r) =>
          r.id === action.rule.id ? action.rule : r,
        ),
      };

    case 'GLOBAL_RULE_DELETE':
      return {
        ...state,
        globalRules: state.globalRules.filter((r) => r.id !== action.id),
      };

    case 'GLOBAL_RULES_REORDER':
      return { ...state, globalRules: action.rules };

    // ── Import / Reset ───────────────────────────────────────────────────────
    case 'IMPORT_CONFIG':
      return {
        entities:    action.entities    ?? state.entities,
        globalRules: action.globalRules ?? state.globalRules,
        entityRules: action.entityRules ?? state.entityRules,
        sprites:     action.sprites     ?? state.sprites,
      };

    case 'MERGE_IMPORT':
      // Append imported entities and their rules, merging global rules.
      return {
        ...state,
        entities:    [...state.entities, ...action.entities],
        globalRules: [...state.globalRules, ...action.globalRules],
        entityRules: { ...state.entityRules, ...action.entityRules },
      };

    case 'RESET_DEFAULTS':
      return {
        entities:    DEFAULT_ENTITIES,
        globalRules: DEFAULT_GLOBAL_RULES,
        entityRules: DEFAULT_ENTITY_RULES,
        sprites:     DEFAULT_SPRITES,
      };

    // ── Sprites ─────────────────────────────────────────────────────────────
    case 'SPRITE_ADD':
      return { ...state, sprites: [...state.sprites, action.sprite] };

    case 'SPRITE_UPDATE':
      return {
        ...state,
        sprites: state.sprites.map((s) =>
          s.id === action.sprite.id ? { ...s, ...action.sprite } : s,
        ),
      };

    case 'SPRITE_DELETE':
      return { ...state, sprites: state.sprites.filter((s) => s.id !== action.id) };

    // ── Entity Rules ────────────────────────────────────────────────────────
    case 'ENTITY_RULE_ADD': {
      const prev = state.entityRules[action.entityId] ?? [];
      return {
        ...state,
        entityRules: { ...state.entityRules, [action.entityId]: [...prev, action.rule] },
      };
    }

    case 'ENTITY_RULE_UPDATE': {
      const prev = state.entityRules[action.entityId] ?? [];
      return {
        ...state,
        entityRules: {
          ...state.entityRules,
          [action.entityId]: prev.map((r) =>
            r.id === action.rule.id ? action.rule : r,
          ),
        },
      };
    }

    case 'ENTITY_RULE_DELETE': {
      const prev = state.entityRules[action.entityId] ?? [];
      return {
        ...state,
        entityRules: {
          ...state.entityRules,
          [action.entityId]: prev.filter((r) => r.id !== action.ruleId),
        },
      };
    }

    case 'ENTITY_RULES_REORDER': {
      return {
        ...state,
        entityRules: {
          ...state.entityRules,
          [action.entityId]: action.rules,
        },
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// History wrapper for undo / redo
// ---------------------------------------------------------------------------
const NO_HISTORY = new Set(['IMPORT_CONFIG', 'RESET_DEFAULTS', 'MERGE_IMPORT']);
const MAX_HISTORY = 50;

function historyReducer(history, action) {
  if (action.type === 'UNDO') {
    if (history.past.length === 0) return history;
    const newPresent = history.past[history.past.length - 1];
    return {
      past:         history.past.slice(0, -1),
      present:      newPresent,
      future:       [history.present, ...history.future.slice(0, MAX_HISTORY - 1)],
      undoVersion:  (history.undoVersion ?? 0) + 1,
    };
  }
  if (action.type === 'REDO') {
    if (history.future.length === 0) return history;
    const [newPresent, ...newFuture] = history.future;
    return {
      past:         [...history.past.slice(-(MAX_HISTORY - 1)), history.present],
      present:      newPresent,
      future:       newFuture,
      undoVersion:  (history.undoVersion ?? 0) + 1,
    };
  }
  const newPresent = reducer(history.present, action);
  if (newPresent === history.present) return history;
  if (NO_HISTORY.has(action.type)) {
    return { past: [], present: newPresent, future: [], undoVersion: history.undoVersion ?? 0 };
  }
  return {
    past:         [...history.past.slice(-(MAX_HISTORY - 1)), history.present],
    present:      newPresent,
    future:       [],
    undoVersion:  history.undoVersion ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function SimProvider({ children }) {
  const [history, dispatch] = useReducer(historyReducer, {
    past:        [],
    present:     initialState,
    future:      [],
    undoVersion: 0,
  });

  const state       = history.present;
  const canUndo     = history.past.length > 0;
  const canRedo     = history.future.length > 0;
  const undoVersion = history.undoVersion ?? 0;

  // Auto-save to localStorage whenever config changes.
  useEffect(() => {
    saveToStorage(state.entities, state.globalRules, state.entityRules, state.sprites);
  }, [state.entities, state.globalRules, state.entityRules, state.sprites]);

  // Stable action creators — never recreated after mount.
  const actions = useMemo(() => ({
    addEntity:          (entity)              => dispatch({ type: 'ENTITY_ADD',           entity }),
    updateEntity:       (entity)              => dispatch({ type: 'ENTITY_UPDATE',        entity }),
    deleteEntity:       (id)                  => dispatch({ type: 'ENTITY_DELETE',        id }),
    addGlobalRule:      (rule)                => dispatch({ type: 'GLOBAL_RULE_ADD',      rule }),
    updateGlobalRule:   (rule)                => dispatch({ type: 'GLOBAL_RULE_UPDATE',   rule }),
    deleteGlobalRule:   (id)                  => dispatch({ type: 'GLOBAL_RULE_DELETE',   id }),
    reorderGlobalRules: (rules)               => dispatch({ type: 'GLOBAL_RULES_REORDER', rules }),
    addEntityRule:      (entityId, rule)      => dispatch({ type: 'ENTITY_RULE_ADD',      entityId, rule }),
    updateEntityRule:   (entityId, rule)      => dispatch({ type: 'ENTITY_RULE_UPDATE',   entityId, rule }),
    deleteEntityRule:   (entityId, ruleId)    => dispatch({ type: 'ENTITY_RULE_DELETE',   entityId, ruleId }),
    reorderEntityRules: (entityId, rules)     => dispatch({ type: 'ENTITY_RULES_REORDER', entityId, rules }),
    importConfig:       (cfg)                 => dispatch({ type: 'IMPORT_CONFIG',        ...cfg }),
    mergeImport:        (cfg)                 => dispatch({ type: 'MERGE_IMPORT',         ...cfg }),
    resetDefaults:      ()                    => dispatch({ type: 'RESET_DEFAULTS' }),
    undo:               ()                    => dispatch({ type: 'UNDO' }),
    redo:               ()                    => dispatch({ type: 'REDO' }),
    addSprite:          (sprite)              => dispatch({ type: 'SPRITE_ADD',           sprite }),
    updateSprite:       (sprite)              => dispatch({ type: 'SPRITE_UPDATE',        sprite }),
    deleteSprite:       (id)                  => dispatch({ type: 'SPRITE_DELETE',        id }),
  }), []);

  // Pre-built RGBA color table: colorTable[id * 4 .. id * 4 + 3] = [r, g, b, a]
  // SimCanvas reads this every frame to map cell IDs → pixel colors.
  const colorTable = useMemo(() => {
    const table = new Uint8Array(256 * 4);
    // EMPTY (id=0) → dark background
    table[0] = 28; table[1] = 28; table[2] = 42; table[3] = 255;
    for (const e of state.entities) {
      if (e.id >= 1 && e.id <= 255) {
        table[e.id * 4 + 0] = e.color[0];
        table[e.id * 4 + 1] = e.color[1];
        table[e.id * 4 + 2] = e.color[2];
        table[e.id * 4 + 3] = e.color[3];
      }
    }
    return table;
  }, [state.entities]);

  const value = useMemo(
    () => ({ ...state, ...actions, colorTable, canUndo, canRedo, undoVersion }),
    [state, actions, colorTable, canUndo, canRedo, undoVersion],
  );

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useSimContext() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSimContext must be used inside <SimProvider>');
  return ctx;
}
