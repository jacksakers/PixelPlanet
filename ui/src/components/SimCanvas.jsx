import { useEffect, useRef, useState, useCallback } from 'react';
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
 */
export default function SimCanvas({ selectedTypeRef, brushSizeRef, isPausedRef, tickRateRef, clearCanvasRef }) {
  const canvasRef       = useRef(null);
  const modRef          = useRef(null);
  const rafRef          = useRef(null);
  const mouseRef        = useRef({ down: false, x: 0, y: 0 });
  const tickAccRef      = useRef(0); // fractional tick accumulator for sub-1× speeds
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
          clearCanvasRef.current = () => engineInit(mod, GRID_W, GRID_H);
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
  // Mouse helpers — convert CSS coords → grid coords
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

  const onMouseDown  = useCallback((e) => { mouseRef.current = { down: true,  ...toGrid(e) }; }, [toGrid]);
  const onMouseMove  = useCallback((e) => { if (mouseRef.current.down) mouseRef.current = { down: true, ...toGrid(e) }; }, [toGrid]);
  const onMouseUp    = useCallback(()  => { mouseRef.current.down = false; }, []);
  const onMouseLeave = useCallback(()  => { mouseRef.current.down = false; }, []);

  const onTouchStart = useCallback((e) => { e.preventDefault(); mouseRef.current = { down: true, ...toGrid(e.touches[0]) }; }, [toGrid]);
  const onTouchMove  = useCallback((e) => { e.preventDefault(); mouseRef.current = { down: true, ...toGrid(e.touches[0]) }; }, [toGrid]);
  const onTouchEnd   = useCallback(()  => { mouseRef.current.down = false; }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f0f18',
    }}>
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
          cursor: 'crosshair',
          imageRendering: 'pixelated',
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: `${GRID_W} / ${GRID_H}`,
          border: '1px solid #2d2d42',
          boxShadow: '0 0 24px rgba(0,0,0,0.6)',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
}
