import { useEffect, useRef, useState, useCallback } from 'react'
import init, { Universe } from './wasm/engine'
import type { EntityDef, Direction, Condition, Rule } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRID_W = 500
const GRID_H = 500

// ---------------------------------------------------------------------------
// Default entities & rules (Phase 2 built-ins — data-driven)
// ---------------------------------------------------------------------------
const DEFAULT_ENTITIES: EntityDef[] = [
  { id: 1, name: 'Sand',  color: [194, 178, 128, 255], density: 1.5 },
  { id: 2, name: 'Water', color: [64,  130, 214, 200], density: 1.0 },
  { id: 3, name: 'Stone', color: [120, 120, 130, 255], density: 3.0 },
]

/** Returns the list of rules that reproduce Phase 1 physics in a data-driven way. */
function defaultRules(): Rule[] {
  const empty = 0
  const water = 2

  // Helper builders
  const orNeighbor = (dir: Direction, ...ids: number[]): Condition => ({
    type: 'Or',
    checks: ids.map((id) => ({ type: 'NeighborCheck', dir, target_id: id })),
  })

  return [
    // ── Sand ────────────────────────────────────────────────────────────────
    // 1. Fall straight down into empty or water
    { entity_id: 1, trigger: 'OnTick', condition: orNeighbor('Down', empty, water), actions: [{ type: 'Swap', dir: 'Down' }] },
    // 2. Diagonal-left first (50 % chance)
    { entity_id: 1, trigger: 'OnTick', condition: { type: 'And', checks: [{ type: 'Chance', probability: 0.5 }, orNeighbor('DownLeft', empty, water)] }, actions: [{ type: 'Swap', dir: 'DownLeft' }] },
    // 3. Diagonal-right
    { entity_id: 1, trigger: 'OnTick', condition: orNeighbor('DownRight', empty, water), actions: [{ type: 'Swap', dir: 'DownRight' }] },
    // 4. Diagonal-left fallback (when rule 2's Chance failed)
    { entity_id: 1, trigger: 'OnTick', condition: orNeighbor('DownLeft', empty, water), actions: [{ type: 'Swap', dir: 'DownLeft' }] },

    // ── Water ───────────────────────────────────────────────────────────────
    // 5. Fall straight down
    { entity_id: 2, trigger: 'OnTick', condition: { type: 'NeighborCheck', dir: 'Down', target_id: empty }, actions: [{ type: 'Swap', dir: 'Down' }] },
    // 6. Spread left (50 % chance)
    { entity_id: 2, trigger: 'OnTick', condition: { type: 'And', checks: [{ type: 'Chance', probability: 0.5 }, { type: 'NeighborCheck', dir: 'Left', target_id: empty }] }, actions: [{ type: 'Swap', dir: 'Left' }] },
    // 7. Spread right
    { entity_id: 2, trigger: 'OnTick', condition: { type: 'NeighborCheck', dir: 'Right', target_id: empty }, actions: [{ type: 'Swap', dir: 'Right' }] },
    // 8. Diagonal-down-left
    { entity_id: 2, trigger: 'OnTick', condition: { type: 'NeighborCheck', dir: 'DownLeft', target_id: empty }, actions: [{ type: 'Swap', dir: 'DownLeft' }] },
    // 9. Diagonal-down-right
    { entity_id: 2, trigger: 'OnTick', condition: { type: 'NeighborCheck', dir: 'DownRight', target_id: empty }, actions: [{ type: 'Swap', dir: 'DownRight' }] },
    // 10. Spread left fallback
    { entity_id: 2, trigger: 'OnTick', condition: { type: 'NeighborCheck', dir: 'Left', target_id: empty }, actions: [{ type: 'Swap', dir: 'Left' }] },
  ]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hexToRgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255]
}

function rgbaToCss([r, g, b, a]: [number, number, number, number]): string {
  return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`
}

function rgbaToHex([r, g, b]: [number, number, number, number]): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const ERASE_ENTITY: EntityDef = { id: 0, name: 'Erase', color: [15, 15, 20, 255], density: 0 }

const DIRECTIONS: Direction[] = ['Up', 'Down', 'Left', 'Right', 'UpLeft', 'UpRight', 'DownLeft', 'DownRight']

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const universeRef  = useRef<Universe | null>(null)
  const animFrameRef = useRef<number>(0)
  const isDrawingRef = useRef(false)

  const [entities, setEntities]           = useState<EntityDef[]>(DEFAULT_ENTITIES)
  const [selectedEntity, setSelectedEntity] = useState<EntityDef>(DEFAULT_ENTITIES[0])
  const [brushSize, setBrushSize]         = useState(4)
  const [fps, setFps]                     = useState(0)
  const [paused, setPaused]               = useState(false)
  const pausedRef = useRef(false)
  const [showLab, setShowLab]             = useState(false)
  const [labTab, setLabTab]               = useState<'entity' | 'rule'>('entity')
  const [nextId, setNextId]               = useState(4) // ids 1-3 are defaults

  // Entity creator form state
  const [newName,    setNewName]    = useState('')
  const [newHex,     setNewHex]     = useState('#ff6600')
  const [newDensity, setNewDensity] = useState(1.0)

  // Rule builder form state
  const [ruleEntityId,    setRuleEntityId]    = useState(1)
  const [condType,        setCondType]        = useState<'None' | 'NeighborCheck' | 'Chance'>('NeighborCheck')
  const [condDir,         setCondDir]         = useState<Direction>('Down')
  const [condTargetId,    setCondTargetId]    = useState(0)
  const [condProb,        setCondProb]        = useState(0.5)
  const [actionType,      setActionType]      = useState<'Swap' | 'Transform' | 'Destroy'>('Swap')
  const [actionDir,       setActionDir]       = useState<Direction>('Down')
  const [actionTargetId,  setActionTargetId]  = useState(1)
  const [ruleError,       setRuleError]       = useState('')
  const [entityError,     setEntityError]     = useState('')

  useEffect(() => { pausedRef.current = paused }, [paused])

  // ---------------------------------------------------------------------------
  // Canvas coordinate helpers
  // ---------------------------------------------------------------------------
  const canvasToGrid = useCallback(
    (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: Math.floor((clientX - rect.left) * (GRID_W / rect.width)),
        y: Math.floor((clientY - rect.top)  * (GRID_H / rect.height)),
      }
    },
    [],
  )

  const paint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas   = canvasRef.current
      const universe = universeRef.current
      if (!canvas || !universe) return
      const { x, y } = canvasToGrid(canvas, clientX, clientY)
      universe.paint(x, y, brushSize, selectedEntity.id)
    },
    [brushSize, selectedEntity, canvasToGrid],
  )

  // ---------------------------------------------------------------------------
  // Initialise WASM + start render loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function start() {
      const wasmExports = await init()
      if (cancelled) return

      const universe = new Universe(GRID_W, GRID_H, Date.now() & 0xffffffff)

      // Register default entities & rules
      for (const e of DEFAULT_ENTITIES) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(universe as any).register_entity(JSON.stringify(e))
      }
      for (const r of defaultRules()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(universe as any).register_rule(JSON.stringify(r))
      }

      universeRef.current = universe

      const canvas = canvasRef.current!
      const ctx    = canvas.getContext('2d')!

      let lastTime  = performance.now()
      let frameCount = 0
      let fpsTimer   = 0

      function loop(now: number) {
        if (cancelled) return

        const dt = now - lastTime
        lastTime = now
        frameCount++
        fpsTimer += dt
        if (fpsTimer >= 1000) {
          setFps(frameCount)
          frameCount = 0
          fpsTimer -= 1000
        }

        if (!pausedRef.current) universe.tick()

        const ptr   = universe.render()
        const len   = universe.buffer_len()
        const rgba  = new Uint8ClampedArray(wasmExports.memory.buffer, ptr, len)
        ctx.putImageData(new ImageData(rgba, GRID_W, GRID_H), 0, 0)

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
  // Pointer event handlers
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
    },
    [paint],
  )

  const onPointerUp = useCallback(() => { isDrawingRef.current = false }, [])

  // ---------------------------------------------------------------------------
  // Entity creator
  // ---------------------------------------------------------------------------
  const handleAddEntity = useCallback(() => {
    setEntityError('')
    const trimmed = newName.trim()
    if (!trimmed) { setEntityError('Name is required'); return }
    if (nextId > 255) { setEntityError('Maximum 255 entity types reached'); return }

    const entity: EntityDef = { id: nextId, name: trimmed, color: hexToRgba(newHex), density: newDensity }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(universeRef.current as any)?.register_entity(JSON.stringify(entity))
    } catch (e) {
      setEntityError(String(e)); return
    }

    setEntities((prev) => [...prev, entity])
    setNextId((n) => n + 1)
    setNewName('')
  }, [newName, newHex, newDensity, nextId])

  // ---------------------------------------------------------------------------
  // Rule builder
  // ---------------------------------------------------------------------------
  const handleAddRule = useCallback(() => {
    setRuleError('')

    let condition: Condition | null = null
    if (condType === 'NeighborCheck') {
      condition = { type: 'NeighborCheck', dir: condDir, target_id: condTargetId }
    } else if (condType === 'Chance') {
      condition = { type: 'Chance', probability: condProb }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let actions: any[]
    if (actionType === 'Swap')      actions = [{ type: 'Swap',      dir: actionDir }]
    else if (actionType === 'Transform') actions = [{ type: 'Transform', target_id: actionTargetId }]
    else                            actions = [{ type: 'Destroy' }]

    const rule: Rule = { entity_id: ruleEntityId, trigger: 'OnTick', condition, actions }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(universeRef.current as any)?.register_rule(JSON.stringify(rule))
    } catch (e) {
      setRuleError(String(e)); return
    }
  }, [ruleEntityId, condType, condDir, condTargetId, condProb, actionType, actionDir, actionTargetId])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const allPaintEntities = [ERASE_ENTITY, ...entities]

  return (
    <div style={styles.root}>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        <span style={styles.title}>Pixel Planet</span>

        {/* Entity palette */}
        <div style={styles.group}>
          {allPaintEntities.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedEntity(e)}
              style={{
                ...styles.pixelBtn,
                outline: selectedEntity.id === e.id ? '2px solid #fff' : '2px solid transparent',
              }}
              title={e.name}
            >
              <span style={{ ...styles.swatch, background: rgbaToCss(e.color), border: '1px solid #555' }} />
              <span>{e.name}</span>
            </button>
          ))}
        </div>

        {/* Brush size */}
        <div style={styles.group}>
          <label style={styles.label}>Brush&nbsp;</label>
          <input type="range" min={1} max={20} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))} style={{ width: 80 }} />
          <span style={styles.label}>&nbsp;{brushSize}</span>
        </div>

        <button style={styles.btn} onClick={() => setPaused((p) => !p)}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button style={{ ...styles.btn, background: showLab ? '#3a3a5e' : undefined }}
          onClick={() => setShowLab((v) => !v)}>
          🧪 Lab
        </button>

        <span style={styles.fps}>{fps} fps</span>
      </div>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div style={styles.mainArea}>
        {/* Canvas */}
        <div style={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            width={GRID_W}
            height={GRID_H}
            style={styles.canvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>

        {/* ── Lab panel ─────────────────────────────────────────────── */}
        {showLab && (
          <div style={styles.lab}>
            <div style={styles.labTabs}>
              <button style={{ ...styles.labTabBtn, ...(labTab === 'entity' ? styles.labTabActive : {}) }}
                onClick={() => setLabTab('entity')}>New Entity</button>
              <button style={{ ...styles.labTabBtn, ...(labTab === 'rule' ? styles.labTabActive : {}) }}
                onClick={() => setLabTab('rule')}>New Rule</button>
            </div>

            {/* Entity creator */}
            {labTab === 'entity' && (
              <div style={styles.labForm}>
                <label style={styles.label}>Name</label>
                <input style={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Lava" />

                <label style={styles.label}>Color</label>
                <div style={styles.group}>
                  <input type="color" value={newHex} onChange={(e) => setNewHex(e.target.value)} style={{ width: 40, height: 28, cursor: 'pointer', border: 'none', background: 'none' }} />
                  <span style={styles.label}>{newHex}</span>
                </div>

                <label style={styles.label}>Density</label>
                <input style={styles.input} type="number" min={0} step={0.1} value={newDensity}
                  onChange={(e) => setNewDensity(parseFloat(e.target.value) || 0)} />

                {entityError && <span style={styles.error}>{entityError}</span>}
                <button style={styles.addBtn} onClick={handleAddEntity}>+ Add Entity (id {nextId})</button>

                <div style={styles.entityList}>
                  {entities.map((e) => (
                    <div key={e.id} style={styles.entityRow}>
                      <span style={{ ...styles.swatch, background: rgbaToCss(e.color), width: 16, height: 16 }} />
                      <span style={styles.label}>[{e.id}] {e.name} (d={e.density})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rule builder */}
            {labTab === 'rule' && (
              <div style={styles.labForm}>
                <label style={styles.label}>Entity</label>
                <select style={styles.select} value={ruleEntityId} onChange={(e) => setRuleEntityId(Number(e.target.value))}>
                  {entities.map((e) => <option key={e.id} value={e.id}>[{e.id}] {e.name}</option>)}
                </select>

                <label style={styles.label}>Trigger</label>
                <select style={styles.select} value="OnTick" disabled><option>OnTick</option></select>

                <label style={styles.label}>Condition</label>
                <select style={styles.select} value={condType} onChange={(e) => setCondType(e.target.value as typeof condType)}>
                  <option value="None">None (always fires)</option>
                  <option value="NeighborCheck">NeighborCheck</option>
                  <option value="Chance">Chance</option>
                </select>

                {condType === 'NeighborCheck' && (<>
                  <label style={styles.label}>Direction</label>
                  <select style={styles.select} value={condDir} onChange={(e) => setCondDir(e.target.value as Direction)}>
                    {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <label style={styles.label}>Target entity</label>
                  <select style={styles.select} value={condTargetId} onChange={(e) => setCondTargetId(Number(e.target.value))}>
                    <option value={0}>[0] Empty</option>
                    {entities.map((e) => <option key={e.id} value={e.id}>[{e.id}] {e.name}</option>)}
                  </select>
                </>)}

                {condType === 'Chance' && (<>
                  <label style={styles.label}>Probability (0–1)</label>
                  <input style={styles.input} type="number" min={0} max={1} step={0.05}
                    value={condProb} onChange={(e) => setCondProb(parseFloat(e.target.value))} />
                </>)}

                <label style={styles.label}>Action</label>
                <select style={styles.select} value={actionType} onChange={(e) => setActionType(e.target.value as typeof actionType)}>
                  <option value="Swap">Swap</option>
                  <option value="Transform">Transform</option>
                  <option value="Destroy">Destroy</option>
                </select>

                {actionType === 'Swap' && (<>
                  <label style={styles.label}>Swap direction</label>
                  <select style={styles.select} value={actionDir} onChange={(e) => setActionDir(e.target.value as Direction)}>
                    {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </>)}

                {actionType === 'Transform' && (<>
                  <label style={styles.label}>Transform into</label>
                  <select style={styles.select} value={actionTargetId} onChange={(e) => setActionTargetId(Number(e.target.value))}>
                    <option value={0}>[0] Empty</option>
                    {entities.map((e) => <option key={e.id} value={e.id}>[{e.id}] {e.name}</option>)}
                  </select>
                </>)}

                {ruleError && <span style={styles.error}>{ruleError}</span>}
                <button style={styles.addBtn} onClick={handleAddRule}>+ Add Rule</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------
const styles = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100vh', gap: 8, padding: 8 },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const,
    background: '#1a1a2e', padding: '6px 16px', borderRadius: 8,
  },
  title:    { fontWeight: 700, fontSize: 16, color: '#a0c4ff', letterSpacing: 1 },
  group:    { display: 'flex', alignItems: 'center', gap: 6 },
  pixelBtn: { display: 'flex', alignItems: 'center', gap: 4, background: '#2a2a3e', border: 'none', color: '#e0e0e0', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  swatch:   { display: 'inline-block', width: 12, height: 12, borderRadius: 2 },
  label:    { fontSize: 12, color: '#a0a0b0' },
  btn:      { background: '#2a2a3e', border: '1px solid #444', color: '#e0e0e0', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  fps:      { marginLeft: 'auto', fontSize: 12, color: '#60a060', minWidth: 50, textAlign: 'right' as const },

  mainArea:   { flex: 1, display: 'flex', gap: 8, overflow: 'hidden' },
  canvasWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  canvas:     { imageRendering: 'pixelated' as const, cursor: 'crosshair', maxWidth: '100%', maxHeight: '100%', aspectRatio: '1 / 1', border: '1px solid #333' },

  lab:        { width: 240, background: '#12121e', border: '1px solid #333', borderRadius: 8, overflowY: 'auto' as const, padding: 8, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  labTabs:    { display: 'flex', gap: 4 },
  labTabBtn:  { flex: 1, background: '#2a2a3e', border: '1px solid #444', color: '#a0a0b0', padding: '4px 0', borderRadius: 4, cursor: 'pointer', fontSize: 11 },
  labTabActive: { background: '#3a3a5e', color: '#e0e0ff', borderColor: '#6060aa' },
  labForm:    { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  input:      { background: '#1e1e30', border: '1px solid #444', color: '#e0e0e0', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: '100%' },
  select:     { background: '#1e1e30', border: '1px solid #444', color: '#e0e0e0', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: '100%' },
  addBtn:     { background: '#2a4a2a', border: '1px solid #4a8a4a', color: '#a0f0a0', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  error:      { color: '#ff8080', fontSize: 11 },
  entityList: { display: 'flex', flexDirection: 'column' as const, gap: 4, marginTop: 8 },
  entityRow:  { display: 'flex', alignItems: 'center', gap: 6 },
} as const

// keep lint happy — these helpers are used above
void rgbaToHex
