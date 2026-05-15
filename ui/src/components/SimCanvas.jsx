import { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadEngine,
  engineInit,
  engineGetCells,
  engineSetPixel,
  engineUpdate,
} from '../engine/loader.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRID_W = 500;
const GRID_H = 500;

// Pixel type IDs (must match engine/src/main.cpp)
export const PIXEL_EMPTY = 0;
export const PIXEL_SAND  = 1;
export const PIXEL_WATER = 2;
export const PIXEL_STONE = 3;

// RGBA colour table - index = pixel type
const COLORS = new Uint8Array([
  /* EMPTY */  15,  15,  20, 255,
  /* SAND  */ 220, 180,  60, 255,
  /* WATER */  30, 100, 220, 200,
  /* STONE */ 120, 120, 130, 255,
]);
const NUM_TYPES = COLORS.length / 4;

// Brush radius (in grid cells)
const BRUSH_RADIUS = 3;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * SimCanvas
 * Props:
 *   selectedTypeRef  - React.MutableRefObject<number>
 *                      Live ref to the currently selected pixel type.
 *                      Using a ref (not state) avoids re-creating the RAF loop
 *                      every time the user changes tools.
 */
export default function SimCanvas({ selectedTypeRef }) {
  const canvasRef   = useRef(null);
  const modRef      = useRef(null);
  const rafRef      = useRef(null);
  const mouseRef    = useRef({ down: false, x: 0, y: 0 });
  const [status, setStatus] = useState('Loading WASM engine…');

  // Pre-allocated ImageData reused every frame
  const imageDataRef = useRef(null);

  // -------------------------------------------------------------------------
  // Render one frame: map cell types → RGBA, then blit to canvas
  // -------------------------------------------------------------------------
  const renderFrame = useCallback((ctx, mod) => {
    const imgData = imageDataRef.current;
    if (!imgData) return;

    const cells = engineGetCells(mod, GRID_W, GRID_H);
    const buf   = imgData.data;

    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const t  = cells[i] < NUM_TYPES ? cells[i] : 0;
      const ci = t * 4;
      const bi = i * 4;
      buf[bi]     = COLORS[ci];
      buf[bi + 1] = COLORS[ci + 1];
      buf[bi + 2] = COLORS[ci + 2];
      buf[bi + 3] = COLORS[ci + 3];
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
        setStatus('');

        const loop = () => {
          if (!running) return;

          // Draw at current mouse position if button held
          if (mouseRef.current.down) {
            const { x, y } = mouseRef.current;
            const type = selectedTypeRef.current;
            for (let dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++) {
              for (let dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++) {
                if (dx * dx + dy * dy <= BRUSH_RADIUS * BRUSH_RADIUS) {
                  engineSetPixel(mod, x + dx, y + dy, type);
                }
              }
            }
          }

          engineUpdate(mod);
          renderFrame(ctx, mod);
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      })
      .catch((err) => {
        setStatus(err.message);
      });

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Mouse helpers - convert CSS coords → grid coords
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
  const onMouseMove  = useCallback((e) => { if (mouseRef.current.down) mouseRef.current = { down: true,  ...toGrid(e) }; }, [toGrid]);
  const onMouseUp    = useCallback(()  => { mouseRef.current.down = false; }, []);
  const onMouseLeave = useCallback(()  => { mouseRef.current.down = false; }, []);

  // Touch support
  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    mouseRef.current = { down: true, ...toGrid(touch) };
  }, [toGrid]);
  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    mouseRef.current = { down: true, ...toGrid(touch) };
  }, [toGrid]);
  const onTouchEnd = useCallback(() => { mouseRef.current.down = false; }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {status && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(13,13,18,0.92)',
          color: '#e0e0e0',
          padding: '2rem',
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          zIndex: 10,
          fontSize: '0.9rem',
          lineHeight: 1.7,
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
