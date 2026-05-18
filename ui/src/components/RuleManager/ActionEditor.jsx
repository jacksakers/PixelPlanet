/**
 * RuleManager/ActionEditor.jsx
 *
 * Editor for a single action inside a rule.
 */

import { useSimContext } from '../../store/SimContext.jsx';
import { ACTION_TYPES, DIRECTIONS, MODIFY_OPS } from '../../shared/defaults.js';

const S = {
  wrap: {
    display: 'flex',
    gap: 6,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    padding: '5px 8px',
    background: '#16161f',
    borderRadius: 6,
    border: '1px solid #2a2a3a',
  },
  sel: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '3px 6px',
    fontSize: '0.78rem',
  },
  delBtn: {
    padding: '1px 6px',
    background: 'none',
    border: '1px solid #552222',
    borderRadius: 5,
    color: '#aa4444',
    cursor: 'pointer',
    fontSize: '0.72rem',
    marginLeft: 'auto',
  },
  multiDirsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  multiDirsRow: { display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' },
};

function EntitySelect({ value, onChange }) {
  const { entities } = useSimContext();
  return (
    <select style={S.sel} value={String(value ?? '')} onChange={(e) => onChange(parseInt(e.target.value))}>
      <option value="">— select —</option>
      {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  );
}

/** Dropdown of variable names from a given entity. */
function VarSelect({ entityId, value, onChange, entities }) {
  const entity = entities?.find((e) => e.id === entityId);
  const vars   = entity?.variables ?? [];
  if (vars.length === 0) {
    return <span style={{ fontSize: '0.74rem', color: '#666' }}>(no variables on entity)</span>;
  }
  return (
    <select style={S.sel} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">— var —</option>
      {vars.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
    </select>
  );
}

export default function ActionEditor({ action, onChange, onDelete, entityId }) {
  const { entities } = useSimContext();
  function set(partial) { onChange({ ...action, ...partial }); }

  function addDir() { set({ dirs: [...(action.dirs ?? []), 'down'] }); }
  function updateDir(i, d) {
    const next = [...(action.dirs ?? [])]; next[i] = d;
    set({ dirs: next });
  }
  function removeDir(i) {
    const next = [...(action.dirs ?? [])]; next.splice(i, 1);
    set({ dirs: next });
  }

  return (
    <div style={S.wrap}>
      <select style={S.sel} value={action.type} onChange={(e) => set({ type: e.target.value })}>
        {ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>

      {/* Move — single direction */}
      {action.type === 'Move' && (
        <select style={S.sel} value={action.dir ?? 'down'} onChange={(e) => set({ dir: e.target.value })}>
          {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
        </select>
      )}

      {/* MoveFirst — ordered list of directions */}
      {action.type === 'MoveFirst' && (
        <div style={S.multiDirsWrap}>
          {(action.dirs ?? []).map((d, i) => (
            <div key={i} style={S.multiDirsRow}>
              <select style={S.sel} value={d} onChange={(e) => updateDir(i, e.target.value)}>
                {DIRECTIONS.map((dir) => <option key={dir}>{dir}</option>)}
              </select>
              <button style={{ ...S.delBtn, marginLeft: 0 }} onClick={() => removeDir(i)}>✕</button>
            </div>
          ))}
          <button
            onClick={addDir}
            style={{
              background: 'none', border: '1px solid #3a3a55', borderRadius: 5,
              color: '#777', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 6px',
              alignSelf: 'flex-start',
            }}
          >
            + dir
          </button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: '#888', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={action.randomize !== false}
              onChange={(e) => set({ randomize: e.target.checked })}
            />
            randomise order
          </label>
        </div>
      )}

      {/* Transform — pick target entity */}
      {action.type === 'Transform' && (
        <EntitySelect value={action.targetId} onChange={(v) => set({ targetId: v })} />
      )}

      {/* Spawn — pick entity + direction */}
      {action.type === 'Spawn' && (
        <>
          <EntitySelect value={action.targetId} onChange={(v) => set({ targetId: v })} />
          <select style={S.sel} value={action.dir ?? 'up'} onChange={(e) => set({ dir: e.target.value })}>
            {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </>
      )}

      {/* ModifyVariable — pick variable, operator, amount */}
      {action.type === 'ModifyVariable' && (
        <>
          <VarSelect
            entityId={entityId}
            value={action.varName}
            onChange={(v) => set({ varName: v })}
            entities={entities}
          />
          <select style={S.sel} value={action.op ?? '+='} onChange={(e) => set({ op: e.target.value })}>
            {MODIFY_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            style={{ ...S.sel, width: 60 }}
            type="number"
            step="1"
            value={action.val ?? 1}
            onChange={(e) => set({ val: parseFloat(e.target.value) || 0 })}
          />
        </>
      )}

      <button style={S.delBtn} onClick={onDelete}>✕</button>
    </div>
  );
}
