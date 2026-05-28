/**
 * SpriteManager/SpriteEditor.jsx
 *
 * Full-screen modal for creating and editing sprite blueprints.
 * A sprite is a W×H grid where each cell is either 0 (transparent / empty)
 * or a positive entity ID.  Sprites are stamped onto the simulation canvas
 * as a multi-entity brush.
 *
 * Features
 *  - Resolution selector (preset + custom)
 *  - Pointer-event grid (works with mouse AND touch)
 *  - Zoom in/out (adjusts cell pixel size)
 *  - Scrollable grid for large resolutions on small screens
 *  - Entity palette on the right (desktop) / at the bottom (mobile)
 *  - Erase mode (entity 0 = transparent)
 *  - Mirror H / Mirror V buttons
 *  - Clear grid button
 *  - Save / Cancel
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSimContext }                                       from '../../store/SimContext.jsx';
import { newSpriteId, resizeSpriteCells, makeEmptySpriteCells } from '../../shared/defaults.js';

// ── Resolution presets ────────────────────────────────────────────────────────
const RESOLUTIONS = [
  { label: '3×3',   w: 3,  h: 3  },
  { label: '5×5',   w: 5,  h: 5  },
  { label: '8×8',   w: 8,  h: 8  },
  { label: '10×10', w: 10, h: 10 },
  { label: '16×16', w: 16, h: 16 },
  { label: '32×32', w: 32, h: 32 },
];

const MIN_CELL_PX   = 6;
const MAX_CELL_PX   = 80;
const DEFAULT_CELL_PX = 32;

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.88)',
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: '#13131e',
    borderBottom: '1px solid #2a2a3a',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '0.85rem',
    color: '#aaccff',
    fontWeight: 600,
    letterSpacing: '0.04em',
  },
  nameInput: {
    flex: 1,
    minWidth: 120,
    maxWidth: 220,
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ddd',
    padding: '4px 8px',
    fontSize: '0.82rem',
    outline: 'none',
  },
  btn: (variant) => ({
    padding: '4px 12px',
    background:
      variant === 'save'   ? '#1e2e1e' :
      variant === 'cancel' ? 'none'    :
      variant === 'danger' ? 'none'    : '#252538',
    border: `1px solid ${
      variant === 'save'   ? '#446644' :
      variant === 'cancel' ? '#3a3a55' :
      variant === 'danger' ? '#662222' : '#3a3a55'
    }`,
    borderRadius: 5,
    color:
      variant === 'save'   ? '#88cc88' :
      variant === 'cancel' ? '#888'    :
      variant === 'danger' ? '#cc5555' : '#aaa',
    cursor: 'pointer',
    fontSize: '0.78rem',
    flexShrink: 0,
    lineHeight: '1.4',
  }),
  iconBtn: (active) => ({
    padding: '4px 9px',
    background: active ? '#2d2d44' : 'none',
    border: `1px solid ${active ? '#5566aa' : '#3a3a55'}`,
    borderRadius: 5,
    color: active ? '#aaccff' : '#666',
    cursor: 'pointer',
    fontSize: '0.78rem',
    flexShrink: 0,
    lineHeight: '1.4',
  }),
  zoomBtn: {
    width: 28,
    height: 28,
    background: 'rgba(26,26,46,0.85)',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#aaccff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  gridWrap: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 16,
    background: '#0d0d16',
  },
  palette: {
    width: 148,
    minWidth: 148,
    background: '#131320',
    borderLeft: '1px solid #2a2a3a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  paletteHeader: {
    fontSize: '0.65rem',
    color: '#445',
    letterSpacing: '0.1em',
    padding: '8px 10px 4px',
    flexShrink: 0,
  },
  paletteList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  paletteItem: (active, color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    background: active ? '#1e1e32' : 'transparent',
    border: active ? `1px solid ${color}` : '1px solid transparent',
  }),
  paletteSwatch: (color, isErase) => ({
    width: 14,
    height: 14,
    borderRadius: 3,
    background: color,
    border: isErase ? '1px solid #445' : 'none',
    flexShrink: 0,
  }),
  paletteName: (active) => ({
    fontSize: '0.76rem',
    color: active ? '#dde' : '#778',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  // Mobile palette strip at bottom
  mobileBottom: {
    background: '#13131e',
    borderTop: '1px solid #2a2a3a',
    flexShrink: 0,
    padding: '6px 8px',
    paddingBottom: 'env(safe-area-inset-bottom, 6px)',
  },
  mobilePaletteScroll: {
    display: 'flex',
    gap: 6,
    overflowX: 'auto',
    paddingBottom: 4,
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
  },
  mobileSwatchBtn: (active, color) => ({
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
    minWidth: 48,
  }),
  mobileSwatchDot: (color, isErase) => ({
    width: 22,
    height: 22,
    borderRadius: 5,
    background: color,
    border: isErase ? '1px dashed #445' : 'none',
  }),
  mobileSwatchLabel: (active) => ({
    fontSize: '0.58rem',
    color: active ? '#cce' : '#556',
    maxWidth: 44,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  resRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  resSel: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '3px 7px',
    fontSize: '0.78rem',
  },
};

// ── Sprite mini-preview (used in list) ────────────────────────────────────────
export function SpriteThumbnail({ sprite, entities, size = 48 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite) return;
    const ctx = canvas.getContext('2d');
    const { width: w, height: h, cells } = sprite;
    const cellPx = Math.max(1, Math.floor(size / Math.max(w, h)));
    canvas.width  = w * cellPx;
    canvas.height = h * cellPx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark background
    ctx.fillStyle = '#1a1a28';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const id = cells[row * w + col];
        if (!id) continue;
        const entity = entities.find((e) => e.id === id);
        if (!entity) continue;
        const [r, g, b, a] = entity.color;
        ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
        ctx.fillRect(col * cellPx, row * cellPx, cellPx, cellPx);
      }
    }
  }, [sprite, entities, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: 'pixelated', borderRadius: 3, border: '1px solid #2a2a3a' }}
    />
  );
}

// ── Main editor component ─────────────────────────────────────────────────────
export default function SpriteEditor({ sprite, onSave, onCancel }) {
  const { entities } = useSimContext();

  const isNew   = !sprite;
  const [name,   setName]   = useState(sprite?.name   ?? 'New Sprite');
  const [width,  setWidth]  = useState(sprite?.width  ?? 8);
  const [height, setHeight] = useState(sprite?.height ?? 8);
  const [cells,  setCells]  = useState(() =>
    sprite ? [...sprite.cells] : makeEmptySpriteCells(sprite?.width ?? 8, sprite?.height ?? 8),
  );
  const [selectedEntity, setSelectedEntity] = useState(0); // 0 = erase
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);

  const paintingRef = useRef(false);
  const gridRef     = useRef(null);

  // ── Entity colour helper ──────────────────────────────────────────────────
  const entityColor = useCallback((id) => {
    if (!id) return null;
    const e = entities.find((en) => en.id === id);
    if (!e) return null;
    return `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${e.color[3] / 255})`;
  }, [entities]);

  // ── Palette tools list (erase + all entities) ─────────────────────────────
  const paletteTools = useMemo(() => [
    { id: 0, name: 'Erase', color: '#222233', isErase: true },
    ...entities.map((e) => ({
      id:      e.id,
      name:    e.name,
      color:   `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${e.color[3] / 255})`,
      isErase: false,
    })),
  ], [entities]);

  // ── Resolution change (preserves existing content) ───────────────────────
  function handleResolutionChange(newW, newH) {
    setCells((prev) => resizeSpriteCells(prev, width, height, newW, newH));
    setWidth(newW);
    setHeight(newH);
  }

  // ── Paint a cell (with optional mirroring) ───────────────────────────────
  const paintCell = useCallback((idx) => {
    const w = width;
    const h = height;
    const col = idx % w;
    const row = Math.floor(idx / w);

    setCells((prev) => {
      const next = [...prev];
      const paint = (r, c) => {
        if (r >= 0 && r < h && c >= 0 && c < w)
          next[r * w + c] = selectedEntity;
      };
      paint(row, col);
      if (mirrorH) paint(row, w - 1 - col);
      if (mirrorV) paint(h - 1 - row, col);
      if (mirrorH && mirrorV) paint(h - 1 - row, w - 1 - col);
      return next;
    });
  }, [width, height, selectedEntity, mirrorH, mirrorV]);

  // ── Pointer event handlers (mouse + touch unified) ───────────────────────
  const getCellIdx = useCallback((clientX, clientY) => {
    const el = gridRef.current;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const x    = clientX - rect.left;
    const y    = clientY - rect.top;
    const gap  = 1;
    const step = cellPx + gap;
    const col  = Math.floor(x / step);
    const row  = Math.floor(y / step);
    if (col < 0 || col >= width || row < 0 || row >= height) return -1;
    return row * width + col;
  }, [cellPx, width, height]);

  const handlePointerDown = useCallback((e) => {
    if (e.pointerType === 'touch' && e.touches?.length > 1) return;
    e.preventDefault();
    paintingRef.current = true;
    gridRef.current?.setPointerCapture(e.pointerId);
    const idx = getCellIdx(e.clientX, e.clientY);
    if (idx >= 0) paintCell(idx);
  }, [getCellIdx, paintCell]);

  const handlePointerMove = useCallback((e) => {
    if (!paintingRef.current) return;
    e.preventDefault();
    const idx = getCellIdx(e.clientX, e.clientY);
    if (idx >= 0) paintCell(idx);
  }, [getCellIdx, paintCell]);

  const handlePointerUp = useCallback(() => {
    paintingRef.current = false;
  }, []);

  // ── Mirror actions ────────────────────────────────────────────────────────
  function applyMirrorH() {
    setCells((prev) => {
      const next = [...prev];
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < Math.floor(width / 2); col++) {
          const a = row * width + col;
          const b = row * width + (width - 1 - col);
          [next[a], next[b]] = [next[b], next[a]];
        }
      }
      return next;
    });
  }

  function applyMirrorV() {
    setCells((prev) => {
      const next = [...prev];
      for (let row = 0; row < Math.floor(height / 2); row++) {
        for (let col = 0; col < width; col++) {
          const a = row * width + col;
          const b = (height - 1 - row) * width + col;
          [next[a], next[b]] = [next[b], next[a]];
        }
      }
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function handleSave() {
    onSave({
      id:     sprite?.id ?? newSpriteId(),
      name:   name.trim() || 'Sprite',
      width,
      height,
      cells,
    });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, handleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detect mobile ─────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const h  = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // ── Render the paint grid ─────────────────────────────────────────────────
  const gridStyle = {
    display:    'grid',
    gridTemplateColumns: `repeat(${width}, ${cellPx}px)`,
    gridTemplateRows:    `repeat(${height}, ${cellPx}px)`,
    gap:        1,
    background: '#2a2a3a',
    border:     '1px solid #3a3a55',
    userSelect: 'none',
    touchAction: 'none',
    cursor:     'crosshair',
    flexShrink: 0,
  };

  const gridCells = cells.map((id, idx) => {
    const bg = id ? (entityColor(id) ?? '#ff0000') : '#1a1a28';
    return (
      <div
        key={idx}
        style={{
          background:  bg,
          width:       cellPx,
          height:      cellPx,
          boxSizing:   'border-box',
          outline:     id ? 'none' : '1px solid #1e1e2e',
        }}
      />
    );
  });

  // ── Palette (desktop sidebar) ─────────────────────────────────────────────
  const desktopPalette = (
    <div style={S.palette}>
      <div style={S.paletteHeader}>ENTITIES</div>
      <div style={S.paletteList}>
        {paletteTools.map(({ id, name: n, color, isErase }) => {
          const active = selectedEntity === id;
          return (
            <div
              key={id}
              style={S.paletteItem(active, color)}
              onClick={() => setSelectedEntity(id)}
            >
              <span style={S.paletteSwatch(color, isErase)} />
              <span style={S.paletteName(active)}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Mobile palette strip ─────────────────────────────────────────────────
  const mobilePalette = (
    <div style={S.mobileBottom}>
      <div style={S.mobilePaletteScroll}>
        {paletteTools.map(({ id, name: n, color, isErase }) => {
          const active = selectedEntity === id;
          return (
            <button
              key={id}
              style={S.mobileSwatchBtn(active, color)}
              onClick={() => setSelectedEntity(id)}
            >
              <span style={S.mobileSwatchDot(color, isErase)} />
              <span style={S.mobileSwatchLabel(active)}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Full render ───────────────────────────────────────────────────────────
  return (
    <div style={S.overlay}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>{isNew ? 'New Sprite' : 'Edit Sprite'}</span>

        <input
          style={S.nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sprite name…"
        />

        {/* Resolution selector */}
        <div style={S.resRow}>
          <select
            style={S.resSel}
            value={`${width}x${height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              handleResolutionChange(w, h);
            }}
          >
            {RESOLUTIONS.map(({ label, w, h }) => (
              <option key={label} value={`${w}x${h}`}>{label}</option>
            ))}
          </select>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            style={S.zoomBtn}
            onClick={() => setCellPx((p) => Math.min(MAX_CELL_PX, p + 6))}
            title="Zoom in"
          >+</button>
          <span style={{ fontSize: '0.68rem', color: '#556', minWidth: 34, textAlign: 'center' }}>
            {cellPx}px
          </span>
          <button
            style={S.zoomBtn}
            onClick={() => setCellPx((p) => Math.max(MIN_CELL_PX, p - 6))}
            title="Zoom out"
          >−</button>
        </div>

        {/* Mirror toggles */}
        <button
          style={S.iconBtn(mirrorH)}
          title="Mirror paint horizontally"
          onClick={() => setMirrorH((v) => !v)}
        >↔ Mirror H</button>
        <button
          style={S.iconBtn(mirrorV)}
          title="Mirror paint vertically"
          onClick={() => setMirrorV((v) => !v)}
        >↕ Mirror V</button>

        {/* Flip / clear actions */}
        <button style={S.btn()} onClick={applyMirrorH} title="Flip the whole sprite horizontally">Flip H</button>
        <button style={S.btn()} onClick={applyMirrorV} title="Flip the whole sprite vertically">Flip V</button>
        <button
          style={S.btn('danger')}
          onClick={() => setCells(makeEmptySpriteCells(width, height))}
        >Clear</button>

        {/* Save / Cancel */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button style={S.btn('cancel')} onClick={onCancel}>Cancel</button>
          <button style={S.btn('save')}   onClick={handleSave}>Save Sprite</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ ...S.body, flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Paint canvas */}
        <div style={S.gridWrap}>
          <div
            ref={gridRef}
            style={gridStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {gridCells}
          </div>
        </div>

        {/* Entity palette */}
        {isMobile ? null : desktopPalette}
      </div>

      {/* Mobile: entity palette strip at the bottom */}
      {isMobile && mobilePalette}
    </div>
  );
}
