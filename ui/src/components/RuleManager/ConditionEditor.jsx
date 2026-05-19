/**
 * RuleManager/ConditionEditor.jsx
 *
 * Recursive condition tree editor.  Supports all Phase-2 condition types:
 * Always, NeighborCheck, PropertyCheck, Chance, AND, OR, NOT.
 */

import { useSimContext } from '../../store/SimContext.jsx';
import {
  CONDITION_TYPES,
  DIRECTIONS,
  PROPERTY_OPS,
  BUILT_IN_PROPS,
} from '../../shared/defaults.js';

const S = {
  wrap: (depth) => ({
    paddingLeft: depth * 14,
    borderLeft: depth > 0 ? '2px solid #2d2d48' : 'none',
    marginLeft: depth > 0 ? 4 : 0,
    paddingTop: 4,
    paddingBottom: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }),
  row: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  sel: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '3px 6px',
    fontSize: '0.78rem',
  },
  inp: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '3px 6px',
    fontSize: '0.78rem',
    width: 72,
  },
  addBtn: {
    padding: '2px 8px',
    background: 'none',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#777',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  delBtn: {
    padding: '1px 6px',
    background: 'none',
    border: '1px solid #552222',
    borderRadius: 5,
    color: '#aa4444',
    cursor: 'pointer',
    fontSize: '0.72rem',
  },
};

/** Target options: EMPTY, ANY, plus every defined entity (stored as name string). */
function TargetSelect({ value, onChange }) {
  const { entities } = useSimContext();

  // Normalise incoming value: numeric ID → entity name for display.
  const nameOf = (v) => {
    if (v === 'EMPTY' || v === 'ANY') return v;
    if (typeof v === 'number') {
      const e = entities.find((e) => e.id === v);
      return e ? e.name : String(v);
    }
    return String(v ?? 'ANY');
  };

  const display = nameOf(value);

  return (
    <select style={S.sel} value={display} onChange={(e) => {
      const v = e.target.value;
      // Always emit name strings; engine resolves them.
      onChange(v);
    }}>
      <option value="EMPTY">EMPTY</option>
      <option value="ANY">ANY</option>
      {entities.map((e) => (
        <option key={e.id} value={e.name}>{e.name}</option>
      ))}
    </select>
  );
}

/** Variable name dropdown — lists variables from a given entity. */
function VarNameSelect({ entityId, value, onChange }) {
  const { entities } = useSimContext();
  const entity = entities.find((e) => e.id === entityId);
  const vars   = entity?.variables ?? [];
  // Also gather vars from all entities for global context (entityId may be null).
  const allVars = entityId == null
    ? [...new Set(entities.flatMap((e) => (e.variables ?? []).map((v) => v.name)))]
    : vars.map((v) => v.name);

  if (allVars.length === 0) {
    return <span style={{ fontSize: '0.72rem', color: '#555' }}>(add variables to entity first)</span>;
  }
  return (
    <select style={S.sel} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">— var —</option>
      {allVars.map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
  );
}

const CONDITION_DEFAULTS = {
  Always:        { type: 'Always' },
  NeighborCheck: { type: 'NeighborCheck', dir: 'down', target: 'EMPTY' },
  PropertyCheck: { type: 'PropertyCheck', prop: 'density', op: '>', val: 0 },
  VariableCheck: { type: 'VariableCheck', varName: '', op: '>=', val: 0 },
  NeighborCount: { type: 'NeighborCount', target: 'ANY', op: '>=', val: 1 },
  Chance:        { type: 'Chance', val: 50 },
  AND:           { type: 'AND', children: [] },
  OR:            { type: 'OR', children: [] },
  NOT:           { type: 'NOT', children: [] },
};

export default function ConditionEditor({ condition, onChange, onDelete, depth = 0, entityId }) {
  function set(partial) { onChange({ ...condition, ...partial }); }

  function addChild() {
    set({ children: [...(condition.children ?? []), { type: 'Always' }] });
  }
  function updateChild(i, child) {
    const next = [...(condition.children ?? [])];
    next[i] = child;
    set({ children: next });
  }
  function removeChild(i) {
    const next = [...(condition.children ?? [])];
    next.splice(i, 1);
    set({ children: next });
  }

  return (
    <div style={S.wrap(depth)}>
      <div style={S.row}>
        {/* Type selector */}
        <select
          style={S.sel}
          value={condition.type}
          onChange={(e) => onChange(CONDITION_DEFAULTS[e.target.value] ?? { type: e.target.value })}
        >
          {CONDITION_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>

        {/* NeighborCheck fields */}
        {condition.type === 'NeighborCheck' && (
          <>
            <select
              style={S.sel}
              value={condition.dir ?? 'down'}
              onChange={(e) => set({ dir: e.target.value })}
            >
              {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <TargetSelect
              value={condition.target ?? 'EMPTY'}
              onChange={(v) => set({ target: v })}
            />
          </>
        )}

        {/* PropertyCheck fields */}
        {condition.type === 'PropertyCheck' && (
          <>
            <select style={S.sel} value={condition.prop ?? 'density'} onChange={(e) => set({ prop: e.target.value })}>
              {BUILT_IN_PROPS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select style={S.sel} value={condition.op ?? '>'} onChange={(e) => set({ op: e.target.value })}>
              {PROPERTY_OPS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <input
              style={S.inp}
              type="number"
              step="0.1"
              value={condition.val ?? 0}
              onChange={(e) => set({ val: parseFloat(e.target.value) || 0 })}
            />
          </>
        )}

        {/* VariableCheck — check per-cell variable */}
        {condition.type === 'VariableCheck' && (
          <>
            <VarNameSelect
              entityId={entityId}
              value={condition.varName}
              onChange={(v) => set({ varName: v })}
            />
            <select style={S.sel} value={condition.op ?? '>'} onChange={(e) => set({ op: e.target.value })}>
              {PROPERTY_OPS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <input
              style={S.inp}
              type="number"
              step="1"
              value={condition.val ?? 0}
              onChange={(e) => set({ val: parseFloat(e.target.value) || 0 })}
            />
          </>
        )}

        {/* NeighborCount — count matching neighbours */}
        {condition.type === 'NeighborCount' && (
          <>
            <TargetSelect
              value={condition.target ?? 'ANY'}
              onChange={(v) => set({ target: v })}
            />
            <select style={S.sel} value={condition.op ?? '>='} onChange={(e) => set({ op: e.target.value })}>
              {PROPERTY_OPS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <input
              style={S.inp}
              type="number"
              min={0} max={8} step={1}
              value={condition.val ?? 1}
              onChange={(e) => set({ val: parseInt(e.target.value) || 0 })}
            />
          </>
        )}

        {/* Chance field */}
        {condition.type === 'Chance' && (
          <>
            <input
              style={S.inp}
              type="number"
              min={0} max={100} step={1}
              value={condition.val ?? 50}
              onChange={(e) => set({ val: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
            <span style={{ fontSize: '0.72rem', color: '#666' }}>%</span>
          </>
        )}

        {/* Delete button (when nested) */}
        {onDelete && (
          <button style={S.delBtn} onClick={onDelete}>✕</button>
        )}
      </div>

      {/* Recursive children for AND / OR */}
      {(condition.type === 'AND' || condition.type === 'OR') && (
        <>
          {(condition.children ?? []).map((child, i) => (
            <ConditionEditor
              key={i}
              condition={child}
              onChange={(c) => updateChild(i, c)}
              onDelete={() => removeChild(i)}
              depth={depth + 1}
              entityId={entityId}
            />
          ))}
          <button style={{ ...S.addBtn, alignSelf: 'flex-start', marginLeft: depth * 14 + 4 }} onClick={addChild}>
            + condition
          </button>
        </>
      )}

      {/* Single child for NOT */}
      {condition.type === 'NOT' && (
        <ConditionEditor
          condition={(condition.children ?? [])[0] ?? { type: 'Always' }}
          onChange={(c) => set({ children: [c] })}
          depth={depth + 1}
          entityId={entityId}
        />
      )}
    </div>
  );
}
