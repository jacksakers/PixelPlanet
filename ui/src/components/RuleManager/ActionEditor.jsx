/**
 * RuleManager/ActionEditor.jsx
 *
 * Editor for a single action inside a rule.
 */

import { useSimContext } from '../../store/SimContext.jsx';
import { ACTION_TYPES, ACTION_DIRECTIONS, MODIFY_OPS } from '../../shared/defaults.js';

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
  // Normalise: numeric ID → name for display (legacy rule compat).
  const nameOf = (v) => {
    if (!v && v !== 0) return '';
    if (typeof v === 'number') {
      const e = entities.find((e) => e.id === v);
      return e ? e.name : String(v);
    }
    return String(v);
  };
  const display = nameOf(value);
  return (
    <select style={S.sel} value={display} onChange={(e) => onChange(e.target.value)}>
      <option value="">— select —</option>
      {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
    </select>
  );
}

/** Dropdown of variable names from a given entity. Show none by default. */
function VarSelect({ entityId, value, onChange, entities }) {
  const entity = entities?.find((e) => e.id === entityId);
  const vars   = entity?.variables ?? [];
  return (
    <select style={S.sel} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">— select —</option>
      {vars.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
    </select>
  );
}

const ACTION_DEFAULTS = {
  Move:           { type: 'Move', dir: 'down' },
  MoveFirst:      { type: 'MoveFirst', dirs: ['down'], randomize: true },
  Transform:      { type: 'Transform', targetId: '' },
  Spawn:          { type: 'Spawn', targetId: '', dir: 'up' },
  Destroy:        { type: 'Destroy' },
  ModifyVariable: { type: 'ModifyVariable', varName: '', op: '+=', val: 1 },
  Eat:            { type: 'Eat', dir: 'up', target: 'ANY', replaceWith: 'EMPTY', gainVar: '', gainVal: 0 },
  EatFirst:       { type: 'EatFirst', dirs: ['down'], target: 'ANY', replaceWith: 'EMPTY', gainVar: '', gainVal: 0, randomize: true },
  Swap:           { type: 'Swap', dir: 'up', target: 'ANY' },
  SwapFirst:      { type: 'SwapFirst', dirs: ['down'], target: 'ANY', randomize: true },
  MoveToward:     { type: 'MoveToward', target: 'ANY', range: 5 },
  MoveAway:       { type: 'MoveAway', target: 'ANY', range: 5 },
};

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
      <select style={S.sel} value={action.type} onChange={(e) => onChange(ACTION_DEFAULTS[e.target.value] ?? { type: e.target.value })}>
        {ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>

      {/* Move — single direction */}
      {action.type === 'Move' && (
        <select style={S.sel} value={action.dir ?? 'down'} onChange={(e) => set({ dir: e.target.value })}>
          {ACTION_DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
        </select>
      )}

      {/* MoveFirst — ordered list of directions */}
      {action.type === 'MoveFirst' && (
        <div style={S.multiDirsWrap}>
          {(action.dirs ?? []).map((d, i) => (
            <div key={i} style={S.multiDirsRow}>
              <select style={S.sel} value={d} onChange={(e) => updateDir(i, e.target.value)}>
                {ACTION_DIRECTIONS.map((dir) => <option key={dir}>{dir}</option>)}
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
            {ACTION_DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
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

      {/* Eat — single direction, target entity, optional energy gain, optional replace */}
      {action.type === 'Eat' && (
        <>
          <select style={S.sel} value={action.dir ?? 'up'} onChange={(e) => set({ dir: e.target.value })}>
            {ACTION_DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <span style={{ fontSize: '0.74rem', color: '#888' }}>eats</span>
          <select style={S.sel} value={String(action.target ?? 'ANY')}
            onChange={(e) => set({ target: e.target.value })}>
            <option value="ANY">ANY</option>
            {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
          <span style={{ fontSize: '0.74rem', color: '#888' }}>leave</span>
          <select style={S.sel} value={String(action.replaceWith ?? 'EMPTY')}
            onChange={(e) => set({ replaceWith: e.target.value })}>
            <option value="EMPTY">Empty</option>
            {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
          <span style={{ fontSize: '0.74rem', color: '#888' }}>gain</span>
          <VarSelect entityId={entityId} value={action.gainVar ?? ''} onChange={(v) => set({ gainVar: v })} entities={entities} />
          <input style={{ ...S.sel, width: 48 }} type="number" step="1" value={action.gainVal ?? 0}
            onChange={(e) => set({ gainVal: parseFloat(e.target.value) || 0 })} />
        </>
      )}

      {/* EatFirst — multi-direction, target entity, optional energy gain, optional replace */}
      {action.type === 'EatFirst' && (
        <div style={S.multiDirsWrap}>
          <div style={S.multiDirsRow}>
            <span style={{ fontSize: '0.74rem', color: '#888' }}>eats</span>
            <select style={S.sel} value={String(action.target ?? 'ANY')}
              onChange={(e) => set({ target: e.target.value })}>
              <option value="ANY">ANY</option>
              {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <span style={{ fontSize: '0.74rem', color: '#888' }}>leave</span>
            <select style={S.sel} value={String(action.replaceWith ?? 'EMPTY')}
              onChange={(e) => set({ replaceWith: e.target.value })}>
              <option value="EMPTY">Empty</option>
              {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <span style={{ fontSize: '0.74rem', color: '#888' }}>gain</span>
            <VarSelect entityId={entityId} value={action.gainVar ?? ''} onChange={(v) => set({ gainVar: v })} entities={entities} />
            <input style={{ ...S.sel, width: 48 }} type="number" step="1" value={action.gainVal ?? 0}
              onChange={(e) => set({ gainVal: parseFloat(e.target.value) || 0 })} />
          </div>
          {(action.dirs ?? []).map((d, i) => (
            <div key={i} style={S.multiDirsRow}>
              <select style={S.sel} value={d} onChange={(e) => updateDir(i, e.target.value)}>
                {ACTION_DIRECTIONS.map((dir) => <option key={dir}>{dir}</option>)}
              </select>
              <button style={{ ...S.delBtn, marginLeft: 0 }} onClick={() => removeDir(i)}>✕</button>
            </div>
          ))}
          <button onClick={addDir} style={{ background: 'none', border: '1px solid #3a3a55', borderRadius: 5, color: '#777', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 6px', alignSelf: 'flex-start' }}>+ dir</button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: '#888', cursor: 'pointer' }}>
            <input type="checkbox" checked={action.randomize !== false} onChange={(e) => set({ randomize: e.target.checked })} />
            randomise order
          </label>
        </div>
      )}

      {/* Swap — single direction, target entity */}
      {action.type === 'Swap' && (
        <>
          <select style={S.sel} value={action.dir ?? 'up'} onChange={(e) => set({ dir: e.target.value })}>
            {ACTION_DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <span style={{ fontSize: '0.74rem', color: '#888' }}>with</span>
          <select style={S.sel} value={String(action.target ?? 'ANY')}
            onChange={(e) => set({ target: e.target.value })}>
            <option value="ANY">ANY</option>
            {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
        </>
      )}

      {/* SwapFirst — multi-direction, target entity */}
      {action.type === 'SwapFirst' && (
        <div style={S.multiDirsWrap}>
          <div style={S.multiDirsRow}>
            <span style={{ fontSize: '0.74rem', color: '#888' }}>with</span>
            <select style={S.sel} value={String(action.target ?? 'ANY')}
              onChange={(e) => set({ target: e.target.value })}>
              <option value="ANY">ANY</option>
              {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          {(action.dirs ?? []).map((d, i) => (
            <div key={i} style={S.multiDirsRow}>
              <select style={S.sel} value={d} onChange={(e) => updateDir(i, e.target.value)}>
                {ACTION_DIRECTIONS.map((dir) => <option key={dir}>{dir}</option>)}
              </select>
              <button style={{ ...S.delBtn, marginLeft: 0 }} onClick={() => removeDir(i)}>✕</button>
            </div>
          ))}
          <button onClick={addDir} style={{ background: 'none', border: '1px solid #3a3a55', borderRadius: 5, color: '#777', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 6px', alignSelf: 'flex-start' }}>+ dir</button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: '#888', cursor: 'pointer' }}>
            <input type="checkbox" checked={action.randomize !== false} onChange={(e) => set({ randomize: e.target.checked })} />
            randomise order
          </label>
        </div>
      )}

      {/* MoveToward / MoveAway — sense target entity within range, then step toward/away */}
      {(action.type === 'MoveToward' || action.type === 'MoveAway') && (
        <>
          <span style={{ fontSize: '0.74rem', color: '#888' }}>
            {action.type === 'MoveToward' ? 'toward' : 'away from'}
          </span>
          <select style={S.sel} value={String(action.target ?? 'ANY')}
            onChange={(e) => set({ target: e.target.value })}>
            <option value="ANY">ANY</option>
            <option value="EMPTY">EMPTY</option>
            {entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
          <span style={{ fontSize: '0.74rem', color: '#888' }}>range</span>
          <input
            style={{ ...S.sel, width: 48 }}
            type="number"
            min="1"
            max="32"
            step="1"
            value={action.range ?? 5}
            onChange={(e) => set({ range: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </>
      )}

      <button style={S.delBtn} onClick={onDelete}>✕</button>
    </div>
  );
}
