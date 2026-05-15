import { useEffect, useRef, useState, useCallback } from 'react'
import init, { Universe } from './wasm/engine'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRID_W = 500
const GRID_H = 500
const PIXEL_SIZE = 1 // canvas CSS px per sim cell (scale via CSS transform)

const PIXEL_TYPES = [
  { id: 1, label: 'Sand',  color: '#c2b280' },
  { id: 2, label: 'Water', color: '#4082d6' },
  { id: 3, label: 'Stone', color: '#787882' },
  { id: 0, label: 'Erase', color: '#0f0f14' },
] as const

type PixelType = typeof PIXEL_TYPES[number]

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const universeRef = useRef<Universe | null>(null)
  const animFrameRef = useRef<number>(0)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  const [selectedPixel, setSelectedPixel] = useState<PixelType>(PIXEL_TYPES[0])
  const [brushSize, setBrushSize] = useState(4)
  const [fps, setFps] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)

  // Keep pausedRef in sync so the rAF loop can read it without stale closure
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // ---------------------------------------------------------------------------
  // Canvas coordinate helpers
  // ---------------------------------------------------------------------------
  const canvasToGrid = useCallback(
    (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = GRID_W / rect.width
      const scaleY = GRID_H / rect.height
      return {
        x: Math.floor((clientX - rect.left) * scaleX),
        y: Math.floor((clientY - rect.top) * scaleY),
      }
    },
    [],
  )

  const paint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      const universe = universeRef.current
      if (!canvas || !universe) return
      const { x, y } = canvasToGrid(canvas, clientX, clientY)
      universe.paint(x, y, brushSize, selectedPixel.id)
    },
    [brushSize, selectedPixel, canvasToGrid],
  )

  // ---------------------------------------------------------------------------
  // Initialise WASM + start render loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function start() {
      // init() returns the WASM instance exports, which include the linear `memory`
      const wasmExports = await init()
      if (cancelled) return

      const universe = new Universe(GRID_W, GRID_H, Date.now() & 0xffffffff)
      universeRef.current = universe

      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!

      let lastTime = performance.now()
      let frameCount = 0
      let fpsTimer = 0

      function loop(now: number) {
        if (cancelled) return

        const dt = now - lastTime
        lastTime = now

        // FPS counter
        frameCount++
        fpsTimer += dt
        if (fpsTimer >= 1000) {
          setFps(frameCount)
          frameCount = 0
          fpsTimer -= 1000
        }

        if (!pausedRef.current) {
          universe.tick()
        }

        // Read the RGBA buffer from WASM memory — zero-copy path.
        // init() returns wasm instance exports; .memory is the WebAssembly.Memory.
        const ptr = universe.render()
        const len = universe.buffer_len()
        const rgba = new Uint8ClampedArray(wasmExports.memory.buffer, ptr, len)
        const imageData = new ImageData(rgba, GRID_W, GRID_H)
        ctx.putImageData(imageData, 0, 0)

        animFrameRef.current = requestAnimationFrame(loop)
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(animFrameRef.current)
      universeRef.current?.free?.()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Pointer event handlers (mouse + touch)
  // ---------------------------------------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDrawingRef.current = true
      canvasRef.current!.setPointerCapture(e.pointerId)
      paint(e.clientX, e.clientY)
    },
    [paint],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return
      paint(e.clientX, e.clientY)
      lastPosRef.current = { x: e.clientX, y: e.clientY }
    },
    [paint],
  )

  const onPointerUp = useCallback(() => {
    isDrawingRef.current = false
    lastPosRef.current = null
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.title}>Pixel Planet</span>

        {/* Pixel selector */}
        <div style={styles.group}>
          {PIXEL_TYPES.map((pt) => (
            <button
              key={pt.id}
              onClick={() => setSelectedPixel(pt)}
              style={{
                ...styles.pixelBtn,
                outline:
                  selectedPixel.id === pt.id ? '2px solid #fff' : '2px solid transparent',
              }}
              title={pt.label}
            >
              <span
                style={{
                  ...styles.swatch,
                  background: pt.color,
                  border: '1px solid #555',
                }}
              />
              <span>{pt.label}</span>
            </button>
          ))}
        </div>

        {/* Brush size */}
        <div style={styles.group}>
          <label style={styles.label}>Brush&nbsp;</label>
          <input
            type="range"
            min={1}
            max={20}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <span style={styles.label}>&nbsp;{brushSize}</span>
        </div>

        {/* Pause */}
        <button
          style={styles.btn}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <span style={styles.fps}>{fps} fps</span>
      </div>

      {/* Canvas */}
      <div style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={GRID_W * PIXEL_SIZE}
          height={GRID_H * PIXEL_SIZE}
          style={styles.canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline styles (no dependency needed for Phase 1)
// ---------------------------------------------------------------------------
const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    height: '100vh',
    gap: 8,
    padding: 8,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: '#1a1a2e',
    padding: '6px 16px',
    borderRadius: 8,
    width: '100%',
    maxWidth: 900,
    flexWrap: 'wrap' as const,
  },
  title: {
    fontWeight: 700,
    fontSize: 16,
    color: '#a0c4ff',
    letterSpacing: 1,
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pixelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#2a2a3e',
    border: 'none',
    color: '#e0e0e0',
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  swatch: {
    display: 'inline-block',
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    color: '#a0a0b0',
  },
  btn: {
    background: '#2a2a3e',
    border: '1px solid #444',
    color: '#e0e0e0',
    padding: '4px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  fps: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#60a060',
    minWidth: 50,
    textAlign: 'right' as const,
  },
  canvasWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  canvas: {
    imageRendering: 'pixelated' as const,
    cursor: 'crosshair',
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: '1 / 1',
    border: '1px solid #333',
  },
} as const
