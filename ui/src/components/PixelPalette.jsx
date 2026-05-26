/**
 * PixelPalette.jsx
 *
 * Right-side panel for selecting the active paint entity.
 * Replaces the crowded top-toolbar entity buttons with a scrollable
 * colour-coded list that scales to any number of entities.
 *
 * Props:
 *   selectedType   - number (active entity id, 0 = erase)
 *   onSelectType   - (type: number) => void
 *   brushSize      - number
 *   onBrushSize    - (size: number) => void
 */

import { useSimContext } from '../store/SimContext.jsx';
import { PIXEL_EMPTY }  from './SimCanvas.jsx';

const KEYS        = ['1','2','3','4','5','6','7','8','9','0'];
const BRUSH_SIZES = [1, 3, 5, 9, 15];
const WIDTH       = 152;

const S = {
  panel: {
    width: WIDTH,
    minWidth: WIDTH,
    background: '#131320',
    borderLeft: '1px solid #2a2a3a',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    userSelect: 'none',
  },
  header: {
    padding: '8px 10px 6px',
    borderBottom: '1px solid #2a2a3a',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: '0.68rem',
    letterSpacing: '0.1em',
    color: '#556',
    fontWeight: 600,
  },
  entityCount: {
    fontSize: '0.65rem',
    color: '#333',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  item: (active, color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    background: active ? '#1e1e32' : 'transparent',
    border: active ? `1px solid ${color}` : '1px solid transparent',
    transition: 'background 0.1s, border-color 0.1s',
  }),
  swatch: (color, isErase) => ({
    width: 14,
    height: 14,
    borderRadius: 3,
    background: color,
    border: isErase ? '1px solid #445' : 'none',
    flexShrink: 0,
  }),
  itemName: (active) => ({
    fontSize: '0.76rem',
    color: active ? '#dde' : '#778',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  keyHint: {
    fontSize: '0.62rem',
    color: '#333',
    background: '#1a1a26',
    border: '1px solid #2a2a3a',
    borderRadius: 3,
    padding: '0 4px',
    lineHeight: '14px',
    flexShrink: 0,
  },
  divider: {
    height: 1,
    background: '#1e1e2e',
    margin: '4px 6px',
    flexShrink: 0,
  },
  brushSection: {
    borderTop: '1px solid #2a2a3a',
    padding: '8px 10px',
    flexShrink: 0,
  },
  brushLabel: {
    fontSize: '0.65rem',
    color: '#445',
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
  brushRow: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  brushBtn: (active) => ({
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: active ? '#2d2d44' : 'transparent',
    border: active ? '1px solid #5566aa' : '1px solid #2a2a3a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
};

export default function PixelPalette({ selectedType, onSelectType, brushSize, onBrushSize, toolMode = 'paint', onSetToolMode }) {
  const { entities } = useSimContext();

  const tools = [
    ...entities.map((e, i) => ({
      type:  e.id,
      label: e.name,
      color: `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${e.color[3] / 255})`,
      key:   KEYS[i] ?? '',
      isErase: false,
    })),
    {
      type:    PIXEL_EMPTY,
      label:   'Erase',
      color:   '#222233',
      key:     KEYS[entities.length] ?? '',
      isErase: true,
    },
  ];

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span style={S.headerLabel}>PIXELS</span>
        <span style={S.entityCount}>{entities.length} types</span>
      </div>

      <div style={S.list}>
        {tools.map(({ type, label, color, key, isErase }, idx) => {
          const active = selectedType === type;
          // Divider before eraser
          return (
            <div key={type}>
              {isErase && <div style={S.divider} />}
              <div
                style={S.item(active, color)}
                onClick={() => onSelectType(type)}
                title={key ? `${label}  [${key}]` : label}
              >
                <span style={S.swatch(color, isErase)} />
                <span style={S.itemName(active)}>{label}</span>
                {key && <span style={S.keyHint}>{key}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Brush size */}
      <div style={S.brushSection}>
        <div style={S.brushLabel}>BRUSH SIZE</div>
        <div style={S.brushRow}>
          {BRUSH_SIZES.map((sz) => {
            const active = brushSize === sz;
            const dotSize = Math.max(4, Math.min(18, sz * 1.5));
            return (
              <button
                key={sz}
                title={`Radius ${sz}`}
                onClick={() => onBrushSize?.(sz)}
                style={S.brushBtn(active)}
              >
                <span style={{
                  display: 'block',
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: active ? '#aaccff' : '#334',
                }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool mode */}
      <div style={{ borderTop: '1px solid #2a2a3a', padding: '7px 10px', flexShrink: 0 }}>
        <div style={{ fontSize: '0.65rem', color: '#445', letterSpacing: '0.08em', marginBottom: 5 }}>TOOL</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            title="Paint brush"
            onClick={() => onSetToolMode?.('paint')}
            style={{
              flex: 1, padding: '3px 0', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
              background: toolMode === 'paint' ? '#2d2d44' : 'transparent',
              border: toolMode === 'paint' ? '1px solid #5566aa' : '1px solid #2a2a3a',
              color: toolMode === 'paint' ? '#aaccff' : '#556',
            }}
          >🖌 Paint</button>
          <button
            title="Flood fill (click to fill connected region)"
            onClick={() => onSetToolMode?.('fill')}
            style={{
              flex: 1, padding: '3px 0', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
              background: toolMode === 'fill' ? '#2d2d44' : 'transparent',
              border: toolMode === 'fill' ? '1px solid #5566aa' : '1px solid #2a2a3a',
              color: toolMode === 'fill' ? '#aaccff' : '#556',
            }}
          >🪣 Fill</button>
          <button
            title="Eyedropper: right-click canvas or select this tool and click"
            onClick={() => onSetToolMode?.('eyedropper')}
            style={{
              flex: 1, padding: '3px 0', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
              background: toolMode === 'eyedropper' ? '#2d2d44' : 'transparent',
              border: toolMode === 'eyedropper' ? '1px solid #5566aa' : '1px solid #2a2a3a',
              color: toolMode === 'eyedropper' ? '#aaccff' : '#556',
            }}
          >🔍 Pick</button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button
            title="Navigate (no painting — clicks fire OnClick rules; Escape toggles)"
            onClick={() => onSetToolMode?.(toolMode === 'none' ? 'paint' : 'none')}
            style={{
              flex: 1, padding: '3px 0', fontSize: '0.72rem', borderRadius: 5, cursor: 'pointer',
              background: toolMode === 'none' ? '#2d2d44' : 'transparent',
              border: toolMode === 'none' ? '1px solid #5566aa' : '1px solid #2a2a3a',
              color: toolMode === 'none' ? '#aaccff' : '#556',
            }}
          >🧭 Navigate</button>
        </div>
        <div style={{ fontSize: '0.58rem', color: '#334', marginTop: 4 }}>right-click = quick eyedropper · Esc = toggle navigate</div>
      </div>
    </div>
  );
}
