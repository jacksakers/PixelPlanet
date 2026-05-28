/**
 * MobileHUD.jsx
 *
 * Bottom HUD bar shown only on mobile viewports.
 * Contains:
 *   - Editor drawer toggle button (☰)
 *   - Horizontally scrollable entity swatch selector
 *   - Pause / Play toggle
 *   - Clear button
 *   - Brush size selector row
 *
 * Props:
 *   selectedType   number
 *   onSelectType   (type: number) => void
 *   brushSize      number
 *   onBrushSize    (size: number) => void
 *   isPaused       boolean
 *   onTogglePause  () => void
 *   onClear        () => void
 *   onOpenEditor   () => void
 */

import { useSimContext } from '../store/SimContext.jsx';
import { PIXEL_EMPTY }  from './SimCanvas.jsx';

const BRUSH_SIZES = [1, 3, 5, 9, 15];

const S = {
  root: {
    background: '#1a1a26',
    borderTop: '1px solid #2a2a3a',
    flexShrink: 0,
    // Safe area for phones with home indicator
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    userSelect: 'none',
  },
  mainRow: {
    display: 'flex',
    alignItems: 'center',
    height: 56,
    gap: 6,
    padding: '0 8px',
  },
  iconBtn: {
    background: 'none',
    border: '1px solid #3a3a55',
    borderRadius: 7,
    color: '#aaccff',
    cursor: 'pointer',
    fontSize: '1.1rem',
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    lineHeight: 1,
  },
  swatchScroll: {
    flex: 1,
    display: 'flex',
    gap: 5,
    overflowX: 'auto',
    padding: '4px 2px',
    scrollbarWidth: 'none',          // Firefox
    msOverflowStyle: 'none',         // IE/Edge
    WebkitOverflowScrolling: 'touch',
  },
  swatchBtn: (active, color) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '4px 6px',
    background: active ? '#1e1e32' : 'transparent',
    border: `1px solid ${active ? color : '#2a2a3a'}`,
    borderRadius: 8,
    cursor: 'pointer',
    flexShrink: 0,
    minWidth: 46,
    lineHeight: 1,
  }),
  swatchDot: (color, isErase) => ({
    width: 22,
    height: 22,
    borderRadius: 5,
    background: color,
    display: 'block',
    border: isErase ? '1px dashed #445' : 'none',
  }),
  swatchLabel: (active) => ({
    fontSize: '0.58rem',
    color: active ? '#cce' : '#556',
    maxWidth: 42,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  }),
  brushRow: {
    display: 'flex',
    alignItems: 'center',
    height: 34,
    padding: '0 10px',
    gap: 8,
    borderTop: '1px solid #1e1e2e',
  },
  brushLabel: {
    fontSize: '0.58rem',
    color: '#445',
    letterSpacing: '0.07em',
    flexShrink: 0,
  },
  brushBtn: (active) => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: active ? '#2d2d44' : 'transparent',
    border: active ? '1px solid #5566aa' : '1px solid #2a2a3a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  }),
};

export default function MobileHUD({
  selectedType, onSelectType,
  brushSize, onBrushSize,
  isPaused, onTogglePause,
  onClear,
  onOpenEditor,
  toolMode = 'paint', onSetToolMode,
  selectedSprite, onSelectSprite,
}) {
  const { entities, sprites } = useSimContext();

  const tools = [
    ...entities.map((e) => ({
      type:    e.id,
      label:   e.name,
      color:   `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${(e.color[3] ?? 255) / 255})`,
      isErase: false,
      isSprite: false,
    })),
    { type: PIXEL_EMPTY, label: 'Erase', color: '#222233', isErase: true, isSprite: false },
  ];

  return (
    <div style={S.root}>
      {/* ── Main row ────────────────────────────────────────────── */}
      <div style={S.mainRow}>
        {/* Editor drawer button */}
        <button style={S.iconBtn} onClick={onOpenEditor} title="Open editor">
          ☰
        </button>

        {/* Entity swatches — horizontal scroll */}
        <div style={S.swatchScroll}>
          {tools.map(({ type, label, color, isErase }) => {
            const active = toolMode !== 'sprite' && selectedType === type;
            return (
              <button
                key={type}
                style={S.swatchBtn(active, color)}
                onClick={() => {
                  onSelectType(type);
                  onSelectSprite?.(null);
                }}
                title={label}
              >
                <span style={S.swatchDot(color, isErase)} />
                <span style={S.swatchLabel(active)}>{label}</span>
              </button>
            );
          })}

          {/* Sprite swatches */}
          {sprites?.length > 0 && sprites.map((sprite) => {
            const active = toolMode === 'sprite' && selectedSprite?.id === sprite.id;
            // Use the color of the first non-empty entity in the sprite as the swatch color
            const firstId = sprite.cells.find((c) => c !== 0);
            const firstEntity = firstId ? entities.find((e) => e.id === firstId) : null;
            const color = firstEntity
              ? `rgba(${firstEntity.color[0]},${firstEntity.color[1]},${firstEntity.color[2]},${firstEntity.color[3] / 255})`
              : '#445566';
            return (
              <button
                key={sprite.id}
                style={{
                  ...S.swatchBtn(active, active ? '#5566aa' : color),
                  border: `1px solid ${active ? '#5566aa' : '#2a4060'}`,
                }}
                onClick={() => {
                  if (active) {
                    onSelectSprite?.(null);
                    onSetToolMode?.('paint');
                  } else {
                    onSelectSprite?.(sprite);
                    onSetToolMode?.('sprite');
                  }
                }}
                title={`Sprite: ${sprite.name}`}
              >
                {/* 4×4 mini grid preview */}
                <div style={{
                  width: 22,
                  height: 22,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(sprite.width, 4)}, 1fr)`,
                  gridTemplateRows:    `repeat(${Math.min(sprite.height, 4)}, 1fr)`,
                  background: '#1a1a28',
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: active ? '1px solid #5566aa' : '1px solid #2a2a3a',
                  flexShrink: 0,
                }}>
                  {sprite.cells.slice(0, 16).map((id, i) => {
                    const entity = entities.find((e) => e.id === id);
                    const bg = entity
                      ? `rgba(${entity.color[0]},${entity.color[1]},${entity.color[2]},${entity.color[3] / 255})`
                      : 'transparent';
                    return <div key={i} style={{ background: bg }} />;
                  })}
                </div>
                <span style={S.swatchLabel(active)}>{sprite.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tool mode: paint / fill / eyedropper / navigate (icons only) */}
        <button
          style={{ ...S.iconBtn, fontSize: '0.95rem', background: toolMode === 'paint' ? '#2d2d44' : 'none', border: toolMode === 'paint' ? '1px solid #5566aa' : '1px solid #3a3a55' }}
          onClick={() => onSetToolMode?.('paint')}
          title="Paint"
        >🖌️</button>
        <button
          style={{ ...S.iconBtn, fontSize: '0.95rem', background: toolMode === 'fill' ? '#2d2d44' : 'none', border: toolMode === 'fill' ? '1px solid #5566aa' : '1px solid #3a3a55' }}
          onClick={() => onSetToolMode?.('fill')}
          title="Flood fill"
        >🪣</button>
        <button
          style={{ ...S.iconBtn, fontSize: '0.95rem', background: toolMode === 'none' ? '#2d2d44' : 'none', border: toolMode === 'none' ? '1px solid #5566aa' : '1px solid #3a3a55' }}
          onClick={() => onSetToolMode?.(toolMode === 'none' ? 'paint' : 'none')}
          title="Navigate (no painting; taps fire OnClick rules)"
        >🧭</button>

      </div>

      {/* ── Brush size row ───────────────────────────────────────── */}
      <div style={S.brushRow}>
        <span style={S.brushLabel}>BRUSH</span>
        {BRUSH_SIZES.map((sz) => {
          const active  = brushSize === sz;
          const dotSize = Math.max(6, Math.min(20, sz * 1.4));
          return (
            <button
              key={sz}
              style={S.brushBtn(active)}
              onClick={() => onBrushSize?.(sz)}
              title={`Radius ${sz}`}
            >
              <span style={{
                display: 'block',
                width:  dotSize,
                height: dotSize,
                borderRadius: '50%',
                background: active ? '#aaccff' : '#334',
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
