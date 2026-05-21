/**
 * Toolbar.jsx
 *
 * Top bar — brand name + simulation playback controls.
 *
 * Props:
 *   isPaused       boolean
 *   speedIdx       number   (index into speeds[])
 *   speeds         number[] (e.g. [0.25, 0.5, 1, 2, 4, 8])
 *   onTogglePause  () => void
 *   onSpeedUp      () => void
 *   onSlowDown     () => void
 *   onClear        () => void
 *   onStep         () => void
 *   onExport       () => void
 *   canUndo        boolean
 *   canRedo        boolean
 *   onUndo         () => void
 *   onRedo         () => void
 */

const S = {
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0 0.75rem',
    height: 38,
    background: '#1a1a26',
    borderBottom: '1px solid #2a2a3a',
    flexShrink: 0,
    userSelect: 'none',
    overflowX: 'auto',
  },
  divider: {
    width: 1,
    height: 18,
    background: '#2a2a3a',
    flexShrink: 0,
  },
  btn: (active) => ({
    background: active ? '#2d2d48' : 'none',
    border: `1px solid ${active ? '#5566aa' : '#2a2a3a'}`,
    borderRadius: 5,
    color: active ? '#aaccff' : '#778',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '2px 9px',
    lineHeight: '20px',
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    flexShrink: 0,
  }),
  iconBtn: (disabled) => ({
    background: 'none',
    border: '1px solid #2a2a3a',
    borderRadius: 5,
    color: disabled ? '#333' : '#778',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '0.8rem',
    padding: '2px 7px',
    lineHeight: '20px',
    flexShrink: 0,
  }),
  clearBtn: {
    background: 'none',
    border: '1px solid #2a2a3a',
    borderRadius: 5,
    color: '#778',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '2px 9px',
    lineHeight: '20px',
    flexShrink: 0,
  },
  speedLabel: {
    fontSize: '0.72rem',
    color: '#aaccff',
    minWidth: 36,
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
};

function speedLabel(speeds, idx) {
  const v = speeds[idx];
  if (v < 1) return `${Math.round(v * 100) / 100}×`;
  return `${v}×`;
}

export default function Toolbar({
  isPaused, speedIdx, speeds,
  onTogglePause, onSpeedUp, onSlowDown, onClear,
  onStep, onExport,
  canUndo, canRedo, onUndo, onRedo,
}) {
  return (
    <div style={S.root}>
      {/* Brand */}
      <span style={{ fontSize: '0.72rem', letterSpacing: '0.12em', color: '#667', fontWeight: 600, flexShrink: 0 }}>
        PIXEL PLANET
      </span>

      <span style={S.divider} />

      {/* Undo / Redo */}
      <button style={S.iconBtn(!canUndo)} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩</button>
      <button style={S.iconBtn(!canRedo)} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪</button>

      <span style={S.divider} />

      {/* Play / Pause */}
      <button style={S.btn(false)} onClick={onTogglePause} title={isPaused ? 'Play (Space)' : 'Pause (Space)'}>
        {isPaused ? '▶ Play' : '⏸ Pause'}
      </button>

      {/* Step */}
      <button style={S.clearBtn} onClick={onStep} title="Step one tick">⏭ Step</button>

      {/* Speed controls */}
      <button
        style={S.btn(false)}
        onClick={onSlowDown}
        disabled={speedIdx === 0}
        title="Slow down"
      >−</button>
      <span style={S.speedLabel}>{speedLabel(speeds, speedIdx)}</span>
      <button
        style={S.btn(false)}
        onClick={onSpeedUp}
        disabled={speedIdx === speeds.length - 1}
        title="Speed up"
      >+</button>

      <span style={S.divider} />

      {/* Clear */}
      <button style={S.clearBtn} onClick={onClear} title="Clear canvas">Clear</button>

      {/* Export */}
      <button style={S.clearBtn} onClick={onExport} title="Export canvas as PNG">⬇ PNG</button>
    </div>
  );
}
