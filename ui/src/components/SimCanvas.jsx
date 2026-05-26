import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  loadEngine,
  engineInit,
  engineGetCells,
  engineSetPixel,
  engineUpdate,
  engineLoadConfig,
} from '../engine/loader.js';
import { useSimContext }     from '../store/SimContext.jsx';
import { buildEngineConfig } from '../shared/defaults.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRID_W = 500;
const GRID_H = 500;

// Pixel type IDs (must match entity IDs in defaults.js)
export const PIXEL_EMPTY = 0;
export const PIXEL_SAND  = 1;
export const PIXEL_WATER = 2;
export const PIXEL_STONE = 3;

// Brush radius (in grid cells)
const BRUSH_RADIUS = 3;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * SimCanvas
 * Props:
 *   selectedTypeRef  - React.MutableRefObject<number>
 *   brushSizeRef     - React.MutableRefObject<number>  (radius in cells)
 *   isPausedRef      - React.MutableRefObject<boolean> (pause simulation)
 *   tickRateRef      - React.MutableRefObject<number>  (ticks per frame, e.g. 0.5, 1, 2, 4)
 *   clearCanvasRef   - React.MutableRefObject<function|null> (set to clear fn by this component)
 *   stepCanvasRef    - React.MutableRefObject<function|null> (set to step fn — advance one tick)
 *   exportCanvasRef  - React.MutableRefObject<function|null> (set to export fn — PNG download)
 *   toolModeRef      - React.MutableRefObject<'paint'|'fill'|'eyedropper'|'none'> (active tool mode)
 *   onSelectType     - (type: number) => void  (eyedropper right-click callback)
 *   engineRef        - React.MutableRefObject<object|null>  (receives engine interface when ready)
 */
export default function SimCanvas({ selectedTypeRef, brushSizeRef, isPausedRef, tickRateRef, clearCanvasRef, stepCanvasRef, exportCanvasRef, toolModeRef, onSelectType, engineRef }) {
  const canvasRef       = useRef(null);
  const containerRef    = useRef(null);
  const modRef          = useRef(null);
  const rafRef          = useRef(null);
  const mouseRef        = useRef({ down: false, x: 0, y: 0 });
  const tickAccRef      = useRef(0); // fractional tick accumulator for sub-1× speeds
  const tpsRef          = useRef({ count: 0, lastTime: 0, rate: 0 }); // for TPS display
  const tickSpanRef     = useRef(null); // direct DOM ref for zero-re-render tick display
  const [status, setStatus] = useState('Loading WASM engine…');

  const { entities, globalRules, entityRules, colorTable } = useSimContext();

  // Pre-allocated ImageData reused every frame
  const imageDataRef   = useRef(null);
  // Mirror of the last color table sent to the render loop
  const colorTableRef  = useRef(colorTable);

  // Keep colorTableRef in sync so the RAF loop always reads the latest colours
  // without needing to be recreated.
  colorTableRef.current = colorTable;

  // -------------------------------------------------------------------------
  // Sync config → engine whenever entities or rules change
  // -------------------------------------------------------------------------
  useEffect(() => {
    const mod = modRef.current;
    if (!mod) return;
    const config = buildEngineConfig(entities, globalRules, entityRules);
    engineLoadConfig(mod, config);
  }, [entities, globalRules, entityRules]);

  // -------------------------------------------------------------------------
  // Render one frame: map cell types → RGBA via colorTable, blit to canvas
  // -------------------------------------------------------------------------
  const renderFrame = useCallback((ctx, mod) => {
    const imgData = imageDataRef.current;
    if (!imgData) return;

    const cells  = engineGetCells(mod, GRID_W, GRID_H);
    const buf    = imgData.data;
    const colors = colorTableRef.current;

    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const ci = (cells[i] < 256 ? cells[i] : 0) * 4;
      const bi = i * 4;
      buf[bi]     = colors[ci];
      buf[bi + 1] = colors[ci + 1];
      buf[bi + 2] = colors[ci + 2];
      buf[bi + 3] = colors[ci + 3];
    }

    ctx.putImageData(imgData, 0, 0);
  }, []);

  // -------------------------------------------------------------------------
  // Engine bootstrap + animation loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    imageDataRef.current = ctx.createImageData(GRID_W, GRID_H);

    let running = true;

    loadEngine()
      .then((mod) => {
        modRef.current = mod;
        engineInit(mod, GRID_W, GRID_H);

        // Load initial config into engine
        const config = buildEngineConfig(entities, globalRules, entityRules);
        engineLoadConfig(mod, config);

        setStatus('');

        // Expose a clear-canvas function to App via ref
        if (clearCanvasRef) {
          clearCanvasRef.current = () => { engineInit(mod, GRID_W, GRID_H); tpsRef.current = { count: 0, lastTime: 0, rate: 0 }; if (tickSpanRef.current) tickSpanRef.current.textContent = '0 tps'; };
        }

        // Expose single-step to App via ref
        if (stepCanvasRef) {
          stepCanvasRef.current = () => {
            engineUpdate(mod);
            renderFrame(ctx, mod);
          };
        }

        // Expose PNG export to App via ref
        if (exportCanvasRef) {
          exportCanvasRef.current = () => {
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url; a.download = `pixelplanet_${Date.now()}.png`; a.click();
          };
        }

        // Expose engine interface to App for button state, score, etc.
        if (engineRef) {
          engineRef.current = {
            sendClick:       (x, y)       => mod._engine_send_click(x, y),
            setButtonState:  (key, isDown) => mod._engine_set_button_state(key, isDown ? 1 : 0),
            getScore:        ()            => mod._engine_get_score(),
            getGameState:    ()            => mod._engine_get_game_state(),
            resetGame:       ()            => mod._engine_reset_game(),
          };
        }

        const loop = () => {
          if (!running) return;

          if (mouseRef.current.down) {
            const { x, y } = mouseRef.current;
            const type   = selectedTypeRef.current;
            const radius = brushSizeRef?.current ?? BRUSH_RADIUS;
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                  engineSetPixel(mod, x + dx, y + dy, type);
                }
              }
            }
          }

          if (!isPausedRef?.current) {
            // Accumulate fractional ticks and fire whole ticks each frame
            const rate = tickRateRef?.current ?? 1;
            tickAccRef.current += rate;
            const ticks = Math.floor(tickAccRef.current);
            tickAccRef.current -= ticks;
            for (let t = 0; t < ticks; t++) engineUpdate(mod);
            if (ticks > 0) {
              const tps = tpsRef.current;
              tps.count += ticks;
              const now = performance.now();
              if (tps.lastTime === 0) tps.lastTime = now;
              const elapsed = now - tps.lastTime;
              if (elapsed >= 500) {
                tps.rate = Math.round(tps.count / (elapsed / 1000));
                tps.count = 0;
                tps.lastTime = now;
                if (tickSpanRef.current) tickSpanRef.current.textContent = `${tps.rate} tps`;
              }
            }
          }

          renderFrame(ctx, mod);
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      })
      .catch((err) => setStatus(err.message));

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Zoom & pan state
  // -------------------------------------------------------------------------
  const zoomRef        = useRef(1);
  const panRef         = useRef({ x: 0, y: 0 });
  const isPanningRef   = useRef(false);
  const panStartRef    = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const pinchRef       = useRef(null);
  const [zoomDisplay, setZoomDisplay] = useState(1);

  /** Write zoom + pan directly to canvas style (no React re-render needed). */
  const applyTransform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.transform       = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
    canvas.style.transformOrigin = 'center center';
    canvas.style.cursor          = isPanningRef.current ? 'grabbing' : 'crosshair';
  }, []);

  /** Clamp pan so the canvas never vanishes off-screen. */
  const clampPan = useCallback((x, y, zoom) => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return { x, y };
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const cssSize = parseFloat(canvas.style.width) || Math.min(cW, cH);
    const maxPanX = Math.max(0, (cssSize * zoom - cW) / 2);
    const maxPanY = Math.max(0, (cssSize * zoom - cH) / 2);
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, y)),
    };
  }, []);

  /** Zoom to a given level centered on a screen point (sx, sy). */
  const zoomTo = useCallback((newZoom, sx, sy) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ccx  = rect.left + rect.width  / 2;
    const ccy  = rect.top  + rect.height / 2;

    const clamped = Math.max(1, Math.min(8, newZoom));
    const oldZoom = zoomRef.current;
    let newPanX = panRef.current.x + (sx - ccx) * (1 - clamped / oldZoom);
    let newPanY = panRef.current.y + (sy - ccy) * (1 - clamped / oldZoom);

    if (clamped <= 1) { newPanX = 0; newPanY = 0; }
    const p = clampPan(newPanX, newPanY, clamped);

    zoomRef.current = clamped;
    panRef.current  = p;
    applyTransform();
    setZoomDisplay(Math.round(clamped * 100) / 100);
  }, [applyTransform, clampPan]);

  const resetZoom = useCallback(() => {
    zoomRef.current = 1;
    panRef.current  = { x: 0, y: 0 };
    applyTransform();
    setZoomDisplay(1);
  }, [applyTransform]);

  // -------------------------------------------------------------------------
  // Resize observer — fit canvas to container, reapply transform
  // -------------------------------------------------------------------------
  // Scale the canvas CSS size to the largest square that fits the container.
  // The logical resolution (width/height attributes) stays at GRID_W×GRID_H;
  // imageRendering: pixelated handles crisp upscaling.
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    function fit() {
      const { width, height } = container.getBoundingClientRect();
      const size = Math.min(width, height);
      canvas.style.width  = `${size}px`;
      canvas.style.height = `${size}px`;
      applyTransform(); // reapply zoom/pan after resize
    }

    const ro = new ResizeObserver(fit);
    ro.observe(container);
    fit();
    return () => ro.disconnect();
  }, [applyTransform]);

  // -------------------------------------------------------------------------
  // Wheel zoom (non-passive so we can preventDefault)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomTo(zoomRef.current * factor, e.clientX, e.clientY);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  // -------------------------------------------------------------------------
  // toGrid — works correctly because getBoundingClientRect accounts for scale
  // -------------------------------------------------------------------------
  const toGrid = useCallback((e) => {
    const rect   = canvasRef.current.getBoundingClientRect();
    const scaleX = GRID_W / rect.width;
    const scaleY = GRID_H / rect.height;
    return {
      x: Math.floor((e.clientX - rect.left) * scaleX),
      y: Math.floor((e.clientY - rect.top)  * scaleY),
    };
  }, []);

  // -------------------------------------------------------------------------
  // Flood fill (JS BFS on a snapshot of WASM cell buffer)
  // -------------------------------------------------------------------------
  const floodFill = useCallback((x, y, fillType) => {
    const mod = modRef.current;
    if (!mod) return;
    const snapshot = new Uint8Array(engineGetCells(mod, GRID_W, GRID_H)); // copy
    const targetType = snapshot[y * GRID_W + x];
    if (targetType === fillType) return;
    const visited = new Uint8Array(GRID_W * GRID_H);
    const stack = [y * GRID_W + x];
    while (stack.length > 0) {
      const idx = stack.pop();
      if (idx < 0 || idx >= GRID_W * GRID_H) continue;
      if (visited[idx]) continue;
      if (snapshot[idx] !== targetType) continue;
      visited[idx] = 1;
      const cx = idx % GRID_W, cy = Math.floor(idx / GRID_W);
      engineSetPixel(mod, cx, cy, fillType);
      if (cx + 1 < GRID_W)  stack.push(idx + 1);
      if (cx - 1 >= 0)       stack.push(idx - 1);
      if (cy + 1 < GRID_H)  stack.push(idx + GRID_W);
      if (cy - 1 >= 0)       stack.push(idx - GRID_W);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Mouse handlers — left-click draws/fills, middle-click pans, right-click eyedropper
  // -------------------------------------------------------------------------
  const onMouseDown = useCallback((e) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current  = {
        mouseX: e.clientX, mouseY: e.clientY,
        panX: panRef.current.x, panY: panRef.current.y,
      };
      applyTransform();
      return;
    }
    if (e.button === 2) return; // handled by onContextMenu
    const pos = toGrid(e);
    const toolMode = toolModeRef?.current ?? 'paint';
    if (toolMode === 'none') {
      // Navigate mode: fire OnClick rules for the cell under cursor
      const mod = modRef.current;
      if (mod) mod._engine_send_click(pos.x, pos.y);
      return;
    }
    if (toolMode === 'fill') {
      floodFill(pos.x, pos.y, selectedTypeRef.current);
    } else {
      mouseRef.current = { down: true, ...pos };
    }
  }, [toGrid, applyTransform, floodFill, toolModeRef, selectedTypeRef]);

  const onMouseMove = useCallback((e) => {
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      const p  = clampPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy, zoomRef.current);
      panRef.current = p;
      applyTransform();
      return;
    }
    if (mouseRef.current.down) mouseRef.current = { down: true, ...toGrid(e) };
  }, [toGrid, applyTransform, clampPan]);

  const onMouseUp    = useCallback(() => { isPanningRef.current = false; mouseRef.current.down = false; applyTransform(); }, [applyTransform]);
  const onMouseLeave = useCallback(() => { isPanningRef.current = false; mouseRef.current.down = false; applyTransform(); }, [applyTransform]);

  // Right-click = eyedropper: read cell type under cursor and call onSelectType
  const onContextMenu = useCallback((e) => {
    e.preventDefault();
    const mod = modRef.current;
    if (!mod || !onSelectType) return;
    const { x, y } = toGrid(e);
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;
    const cells = engineGetCells(mod, GRID_W, GRID_H);
    onSelectType(cells[y * GRID_W + x]);
  }, [toGrid, onSelectType]);

  // -------------------------------------------------------------------------
  // Touch handlers — attached as non-passive so e.preventDefault() works
  // 1 finger: draw/fill/eyedropper  |  2 fingers: pinch-zoom + pan
  // -------------------------------------------------------------------------
  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      mouseRef.current.down = false;
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      pinchRef.current = { dist, zoom: zoomRef.current, panX: panRef.current.x, panY: panRef.current.y, midX, midY };
      return;
    }
    pinchRef.current = null;
    const pos = toGrid(e.touches[0]);
    const toolMode = toolModeRef?.current ?? 'paint';
    if (toolMode === 'eyedropper') {
      const mod = modRef.current;
      if (mod && onSelectType) {
        const cells = engineGetCells(mod, GRID_W, GRID_H);
        const type = cells[pos.y * GRID_W + pos.x];
        onSelectType(type);
      }
      return;
    }
    if (toolMode === 'fill') {
      floodFill(pos.x, pos.y, selectedTypeRef.current);
      return;
    }
    if (toolMode === 'none') {
      // Navigate mode: fire OnClick rules for tapped cell
      const mod = modRef.current;
      if (mod) mod._engine_send_click(pos.x, pos.y);
      return;
    }
    mouseRef.current = { down: true, ...pos };
  }, [toGrid, toolModeRef, onSelectType, floodFill, selectedTypeRef]);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const newMidX = (t0.clientX + t1.clientX) / 2;
      const newMidY = (t0.clientY + t1.clientY) / 2;

      const pinch    = pinchRef.current;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const ccx  = rect.left + rect.width  / 2;
      const ccy  = rect.top  + rect.height / 2;

      const newZoom  = Math.max(1, Math.min(8, pinch.zoom * newDist / pinch.dist));
      const panDx    = newMidX - pinch.midX;
      const panDy    = newMidY - pinch.midY;
      const zoomPanX = pinch.panX + (pinch.midX - ccx) * (1 - newZoom / pinch.zoom);
      const zoomPanY = pinch.panY + (pinch.midY - ccy) * (1 - newZoom / pinch.zoom);
      const p = clampPan(zoomPanX + panDx, zoomPanY + panDy, newZoom);

      zoomRef.current = newZoom;
      panRef.current  = p;
      applyTransform();
      setZoomDisplay(Math.round(newZoom * 100) / 100);
      return;
    }
    if (e.touches.length === 1 && (toolModeRef?.current ?? 'paint') === 'paint') {
      mouseRef.current = { down: true, ...toGrid(e.touches[0]) };
    }
  }, [toGrid, applyTransform, clampPan, toolModeRef]);

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) mouseRef.current.down = false;
  }, []);

  // Attach touch handlers as non-passive to allow preventDefault()
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  // -------------------------------------------------------------------------
  // Zoom control button styles
  // -------------------------------------------------------------------------
  const zoomBtnStyle = useMemo(() => ({
    background: 'rgba(26,26,46,0.85)',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#aaccff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    userSelect: 'none',
  }), []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f18',
        overflow: 'hidden',
      }}
    >
      {status && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(13,13,18,0.92)', color: '#e0e0e0',
          padding: '2rem', textAlign: 'center', whiteSpace: 'pre-wrap',
          zIndex: 10, fontSize: '0.9rem', lineHeight: 1.7,
        }}>
          {status}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={GRID_W}
        height={GRID_H}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          touchAction: 'none',
          // Actual CSS size is set dynamically by the ResizeObserver above.
          // No width/height CSS here — the observer writes it directly.
          border: '1px solid #2d2d42',
          boxShadow: '0 0 24px rgba(0,0,0,0.6)',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      />

      {/* ── TPS HUD ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        pointerEvents: 'none', zIndex: 4,
      }}>
        <span
          ref={tickSpanRef}
          style={{ fontSize: '0.62rem', color: '#334', fontVariantNumeric: 'tabular-nums' }}
        >0 tps</span>
      </div>

      {/* ── Zoom controls overlay ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        alignItems: 'center',
        zIndex: 5,
      }}>
        <button style={zoomBtnStyle} onClick={() => { const c = containerRef.current?.getBoundingClientRect(); zoomTo(zoomRef.current * 1.5, c ? c.left + c.width / 2 : 0, c ? c.top + c.height / 2 : 0); }} title="Zoom in">+</button>
        <span style={{ fontSize: '0.6rem', color: '#556', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {Math.round(zoomDisplay * 100)}%
        </span>
        <button style={zoomBtnStyle} onClick={() => { const c = containerRef.current?.getBoundingClientRect(); zoomTo(zoomRef.current / 1.5, c ? c.left + c.width / 2 : 0, c ? c.top + c.height / 2 : 0); }} title="Zoom out">−</button>
        <button style={{ ...zoomBtnStyle, fontSize: '0.7rem', marginTop: 2 }} onClick={resetZoom} title="Reset zoom (fit)">⌖</button>
      </div>

      {/* ── Middle-click hint (shown only when zoomed) ────────────────── */}
      {zoomDisplay > 1 && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          fontSize: '0.6rem', color: '#445', pointerEvents: 'none',
        }}>
          middle-drag to pan
        </div>
      )}
    </div>
  );
}

