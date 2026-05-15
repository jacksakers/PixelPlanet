/**
 * EntityManager/EntityList.jsx
 *
 * Scrollable list of all defined entities.  Each row shows a colour swatch,
 * name, and density.  Clicking a row selects it for editing.
 */

import { useSimContext } from '../../store/SimContext.jsx';
import { nextEntityId }  from '../../shared/defaults.js';

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  row: (selected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    background: selected ? '#2d2d48' : 'transparent',
    border: selected ? '1px solid #5566aa' : '1px solid transparent',
    transition: 'background 0.1s',
  }),
  swatch: (color) => ({
    width: 14,
    height: 14,
    borderRadius: 3,
    flexShrink: 0,
    background: `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`,
    border: '1px solid rgba(255,255,255,0.15)',
  }),
  name: {
    flex: 1,
    fontSize: '0.82rem',
    color: '#ddd',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  density: {
    fontSize: '0.72rem',
    color: '#666',
  },
  addBtn: {
    marginTop: 8,
    padding: '5px 10px',
    background: '#252538',
    border: '1px solid #3a3a55',
    borderRadius: 6,
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'border-color 0.1s, color 0.1s',
  },
};

export default function EntityList({ selectedId, onSelect }) {
  const { entities, addEntity } = useSimContext();

  function handleAdd() {
    const id = nextEntityId(entities);
    addEntity({
      id,
      name: `Entity ${id}`,
      color: [180, 120, 200, 255],
      density: 1.0,
      isStatic: false,
    });
    onSelect(id);
  }

  return (
    <div style={S.wrap}>
      {entities.map((e) => (
        <div
          key={e.id}
          style={S.row(e.id === selectedId)}
          onClick={() => onSelect(e.id)}
        >
          <span style={S.swatch(e.color)} />
          <span style={S.name}>{e.name}</span>
          <span style={S.density}>{e.isStatic ? 'static' : `ρ ${e.density}`}</span>
        </div>
      ))}
      <button style={S.addBtn} onClick={handleAdd}>+ New Entity</button>
    </div>
  );
}
