/**
 * EntityManager/index.jsx
 *
 * Shows an editor for the currently-selected entity (driven by the right
 * PixelPalette panel).  No in-panel entity picker — selection is unified.
 */

import { useEffect } from 'react';
import { useState } from 'react';
import EntityEditor from './EntityEditor.jsx';
import { useSimContext } from '../../store/SimContext.jsx';
import { nextEntityId }  from '../../shared/defaults.js';

const S = {
  addBtn: {
    padding: '5px 10px',
    background: '#252538',
    border: '1px solid #3a3a55',
    borderRadius: 6,
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '0.8rem',
    marginBottom: 10,
  },
  empty: {
    fontSize: '0.8rem',
    color: '#445',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 1.7,
  },
};

export default function EntityManager({ selectedType, onSelectType }) {
  const { entities, addEntity } = useSimContext();
  const [selectedId, setSelectedId] = useState(null);

  // Drive selection from the right-panel PixelPalette click
  useEffect(() => {
    if (selectedType && selectedType > 0) setSelectedId(selectedType);
  }, [selectedType]);

  function handleAdd() {
    const id = nextEntityId(entities);
    addEntity({
      id,
      name: `Entity ${id}`,
      color: [180, 120, 200, 255],
      isStatic: false,
    });
    setSelectedId(id);
    onSelectType?.(id); // also update the active palette selection
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button style={S.addBtn} onClick={handleAdd}>+ New Entity</button>
      {selectedId !== null ? (
        <EntityEditor entityId={selectedId} />
      ) : (
        <p style={S.empty}>Select a pixel from the<br />right panel to edit it.</p>
      )}
    </div>
  );
}
