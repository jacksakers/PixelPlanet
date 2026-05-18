/**
 * EntityManager/index.jsx
 *
 * Combines EntityList (left column) + EntityEditor (right column).
 */

import { useState, useEffect } from 'react';
import EntityList   from './EntityList.jsx';
import EntityEditor from './EntityEditor.jsx';

export default function EntityManager({ selectedType }) {
  const [selectedId, setSelectedId] = useState(null);

  // When the toolbar selection changes to a real entity (not eraser/0),
  // sync the entity editor to show that entity.
  useEffect(() => {
    if (selectedType && selectedType > 0) {
      setSelectedId(selectedType);
    }
  }, [selectedType]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <EntityList selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId !== null && (
        <div style={{
          borderTop: '1px solid #2a2a3a',
          paddingTop: 12,
        }}>
          <EntityEditor entityId={selectedId} />
        </div>
      )}
    </div>
  );
}
