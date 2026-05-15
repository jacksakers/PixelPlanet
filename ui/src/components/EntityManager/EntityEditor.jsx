/**
 * EntityManager/EntityEditor.jsx
 *
 * Form for editing a single entity definition: name, colour, density,
 * isStatic.  Fires useSimContext actions on every change for live preview.
 */

import { useState, useEffect } from 'react';
import { useSimContext } from '../../store/SimContext.jsx';

const field = {
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: '0.78rem',
    color: '#888',
  },
  input: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ddd',
    padding: '4px 7px',
    fontSize: '0.82rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
};

export default function EntityEditor({ entityId }) {
  const { entities, updateEntity, deleteEntity } = useSimContext();
  const entity = entities.find((e) => e.id === entityId);

  // Local draft so every keypress doesn't hammer the context.
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    setDraft(entity ? { ...entity } : null);
  }, [entityId, entity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return <p style={{ color: '#555', fontSize: '0.8rem' }}>Select an entity to edit.</p>;

  function commit(partial) {
    const next = { ...draft, ...partial };
    setDraft(next);
    updateEntity(next);
  }

  // hex ↔ [r,g,b] helpers (ignores alpha for the picker)
  function colorToHex([r, g, b]) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function hexToColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, draft.color[3]];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: '#556', fontWeight: 600, letterSpacing: '0.04em' }}>
          ID {draft.id}
        </span>
        <button
          title="Delete entity"
          onClick={() => deleteEntity(draft.id)}
          style={{
            background: 'none', border: '1px solid #552222', borderRadius: 5,
            color: '#aa4444', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 8px',
          }}
        >
          Delete
        </button>
      </div>

      <label style={field.label}>
        Name
        <input
          style={field.input}
          value={draft.name}
          onChange={(e) => commit({ name: e.target.value })}
        />
      </label>

      <label style={field.label}>
        Colour
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            value={colorToHex(draft.color)}
            onChange={(e) => commit({ color: hexToColor(e.target.value) })}
            style={{ width: 36, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          />
          <input
            style={{ ...field.input, flex: 1 }}
            value={colorToHex(draft.color)}
            maxLength={7}
            onChange={(e) => {
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                commit({ color: hexToColor(e.target.value) });
              else setDraft((d) => ({ ...d, _hexRaw: e.target.value }));
            }}
          />
        </div>
      </label>

      <label style={field.label}>
        Opacity (0–255)
        <input
          type="range"
          min={0} max={255}
          value={draft.color[3]}
          onChange={(e) =>
            commit({ color: [draft.color[0], draft.color[1], draft.color[2], Number(e.target.value)] })
          }
          style={{ width: '100%' }}
        />
        <span style={{ color: '#666', fontSize: '0.72rem' }}>{draft.color[3]}</span>
      </label>

      <label style={field.label}>
        Density
        <input
          type="number"
          step="0.1"
          value={draft.density}
          onChange={(e) => commit({ density: parseFloat(e.target.value) || 0 })}
          style={field.input}
          disabled={draft.isStatic}
          title={draft.isStatic ? 'Static entities ignore density' : ''}
        />
        <span style={{ fontSize: '0.7rem', color: '#555' }}>
          {'> 0 = participates in gravity'}
        </span>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '0.82rem', color: '#bbb' }}>
        <input
          type="checkbox"
          checked={draft.isStatic}
          onChange={(e) => commit({ isStatic: e.target.checked, density: e.target.checked ? 0 : draft.density })}
        />
        Static (immovable, no rule evaluation)
      </label>
    </div>
  );
}
