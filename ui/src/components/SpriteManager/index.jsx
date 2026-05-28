/**
 * SpriteManager/index.jsx
 *
 * Manages the list of sprite blueprints — create, edit, delete, and select
 * a sprite for stamping onto the simulation canvas.
 */

import { useState }            from 'react';
import { useSimContext }        from '../../store/SimContext.jsx';
import SpriteEditor, { SpriteThumbnail } from './SpriteEditor.jsx';

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: '0.72rem',
    color: '#666',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  addBtn: {
    padding: '4px 10px',
    background: '#1e2e1e',
    border: '1px solid #446644',
    borderRadius: 5,
    color: '#88cc88',
    cursor: 'pointer',
    fontSize: '0.76rem',
  },
  empty: {
    fontSize: '0.78rem',
    color: '#444',
    lineHeight: 1.6,
    padding: '4px 0',
  },
  card: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: active ? '#1e1e32' : '#16161f',
    border: `1px solid ${active ? '#5566aa' : '#2a2a3a'}`,
    borderRadius: 7,
    cursor: 'pointer',
  }),
  cardName: (active) => ({
    flex: 1,
    fontSize: '0.8rem',
    color: active ? '#dde' : '#aaa',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  cardMeta: {
    fontSize: '0.66rem',
    color: '#445',
    flexShrink: 0,
  },
  cardBtns: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  smallBtn: (variant) => ({
    padding: '2px 7px',
    background: variant === 'del' ? 'none' : '#252538',
    border: `1px solid ${variant === 'del' ? '#552222' : '#3a3a55'}`,
    borderRadius: 4,
    color: variant === 'del' ? '#aa4444' : '#aaa',
    cursor: 'pointer',
    fontSize: '0.7rem',
  }),
  stampHint: {
    padding: '6px 10px',
    background: '#1c2030',
    border: '1px solid #3344aa',
    borderRadius: 6,
    fontSize: '0.74rem',
    color: '#88aaee',
    lineHeight: 1.5,
  },
};

export default function SpriteManager({ selectedSprite, onSelectSprite }) {
  const { sprites, entities, addSprite, updateSprite, deleteSprite } = useSimContext();

  const [editingSprite, setEditingSprite] = useState(null); // null | sprite | '__new__'
  const [confirmId,     setConfirmId]     = useState(null);

  function handleNew() {
    setEditingSprite('__new__');
  }

  function handleEdit(sprite) {
    setEditingSprite(sprite);
  }

  function handleEditorSave(savedSprite) {
    if (editingSprite === '__new__') {
      addSprite(savedSprite);
    } else {
      updateSprite(savedSprite);
    }
    setEditingSprite(null);
    // Auto-select the saved sprite for stamping
    onSelectSprite?.(savedSprite);
  }

  function handleDelete(id) {
    if (confirmId !== id) { setConfirmId(id); return; }
    deleteSprite(id);
    setConfirmId(null);
    if (selectedSprite?.id === id) onSelectSprite?.(null);
  }

  function handleSelect(sprite) {
    // Toggle: clicking the selected sprite deselects it (back to paint mode)
    onSelectSprite?.(selectedSprite?.id === sprite.id ? null : sprite);
  }

  return (
    <>
      {/* Sprite editor modal */}
      {editingSprite && (
        <SpriteEditor
          sprite={editingSprite === '__new__' ? null : editingSprite}
          onSave={handleEditorSave}
          onCancel={() => setEditingSprite(null)}
        />
      )}

      <div style={S.wrap}>
        <div style={S.header}>
          <span style={S.sectionLabel}>Sprites</span>
          <button style={S.addBtn} onClick={handleNew}>+ New Sprite</button>
        </div>

        {/* Stamp hint when a sprite is selected */}
        {selectedSprite && (
          <div style={S.stampHint}>
            🖌 Stamping <strong>{selectedSprite.name}</strong>.  Click the canvas to place it.
            Click the sprite again below to deselect.
          </div>
        )}

        {/* Sprite list */}
        {sprites.length === 0 ? (
          <p style={S.empty}>
            No sprites yet.<br />
            Create one to paint multi-entity shapes onto the canvas.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sprites.map((sprite) => {
              const active = selectedSprite?.id === sprite.id;
              return (
                <div
                  key={sprite.id}
                  style={S.card(active)}
                  onClick={() => handleSelect(sprite)}
                  title={`${sprite.width}×${sprite.height}  —  click to ${active ? 'deselect' : 'stamp'}`}
                >
                  <SpriteThumbnail sprite={sprite} entities={entities} size={36} />
                  <span style={S.cardName(active)}>{sprite.name}</span>
                  <span style={S.cardMeta}>{sprite.width}×{sprite.height}</span>

                  <div style={S.cardBtns} onClick={(e) => e.stopPropagation()}>
                    <button style={S.smallBtn()} onClick={() => handleEdit(sprite)}>Edit</button>
                    {confirmId === sprite.id ? (
                      <>
                        <button style={S.smallBtn('del')} onClick={() => handleDelete(sprite.id)}>Sure?</button>
                        <button style={S.smallBtn()} onClick={() => setConfirmId(null)}>✕</button>
                      </>
                    ) : (
                      <button style={S.smallBtn('del')} onClick={() => handleDelete(sprite.id)}>✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
