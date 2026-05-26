import { useRef, useState, useEffect, useCallback } from 'react';
import SimCanvas, { PIXEL_SAND } from './components/SimCanvas.jsx';
import Toolbar       from './components/Toolbar.jsx';
import Sidebar       from './components/Sidebar.jsx';
import PixelPalette  from './components/PixelPalette.jsx';
import MobileHUD     from './components/MobileHUD.jsx';
import GameController from './components/GameController.jsx';
import ScoreDisplay  from './components/ScoreDisplay.jsx';
import { SimProvider, useSimContext } from './store/SimContext.jsx';
/** Returns true when the viewport width is ≤ 640 px (phone / small tablet). */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 640
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const DEFAULT_SPEED_IDX = 2; // 1× speed

// Inner app component (needs access to context for keyboard shortcuts).
function AppInner() {
  const [selectedType, setSelectedType] = useState(PIXEL_SAND);
  const selectedTypeRef = useRef(PIXEL_SAND);
  const [brushSize, setBrushSize] = useState(3);
  const brushSizeRef = useRef(3);
  const { entities, globalRules, entityRules, undo, redo, canUndo, canRedo, importConfig } = useSimContext();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tool mode: 'paint' | 'fill' | 'eyedropper' | 'none' (navigate)
  const [toolMode, setToolMode]   = useState('paint');
  const toolModeRef               = useRef('paint');
  const handleSetToolMode = useCallback((mode) => {
    toolModeRef.current = mode;
    setToolMode(mode);
  }, []);

  // Engine interface (populated by SimCanvas when WASM loads)
  const engineRef = useRef(null);

  // Game / score state — polled from engine each RAF
  const [score,     setScore]     = useState(0);
  const [gameState, setGameState] = useState(0);  // 0=idle, 1=active, 2=ended

  // Detect whether any rule in the current config uses OnButtonPress
  const hasButtonRules = useCallback(() => {
    const allRules = [
      ...globalRules,
      ...Object.values(entityRules).flat(),
    ];
    return allRules.some((r) => r.trigger === 'OnButtonPress');
  }, [globalRules, entityRules]);

  // Poll score + game state once per animation frame (cheap integer reads)
  useEffect(() => {
    let rafId;
    const poll = () => {
      const eng = engineRef.current;
      if (eng) {
        const gs = eng.getGameState();
        const sc = eng.getScore();
        setGameState((prev) => (prev !== gs ? gs : prev));
        setScore((prev) => (prev !== sc ? sc : prev));
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Simulation controls
  const [isPaused, setIsPaused] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(DEFAULT_SPEED_IDX);
  const isPausedRef    = useRef(false);
  const tickRateRef    = useRef(SPEEDS[DEFAULT_SPEED_IDX]);
  const clearCanvasRef = useRef(null);
  const stepCanvasRef  = useRef(null);
  const exportCanvasRef = useRef(null);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { tickRateRef.current = SPEEDS[speedIdx]; }, [speedIdx]);

  const handleSelectType = useCallback((type) => {
    selectedTypeRef.current = type;
    setSelectedType(type);
    // switch back to paint tool when picking a type
    handleSetToolMode('paint');
  }, [handleSetToolMode]);

  const handleBrushSize = useCallback((size) => {
    brushSizeRef.current = size;
    setBrushSize(size);
  }, []);

  const handleTogglePause = useCallback(() => setIsPaused((p) => !p), []);
  const handleSpeedUp     = useCallback(() => setSpeedIdx((i) => Math.min(i + 1, SPEEDS.length - 1)), []);
  const handleSlowDown    = useCallback(() => setSpeedIdx((i) => Math.max(i - 1, 0)), []);
  const handleClear       = useCallback(() => { clearCanvasRef.current?.(); engineRef.current?.resetGame(); }, []);
  const handleStep        = useCallback(() => { stepCanvasRef.current?.(); }, []);
  const handleExport      = useCallback(() => { exportCanvasRef.current?.(); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    // Arrow key → button key index mapping
    const ARROW_MAP = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 };

    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      // Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      // Arrow keys → OnButtonPress engine events (prevent page scroll)
      if (e.key in ARROW_MAP) {
        e.preventDefault();
        engineRef.current?.setButtonState(ARROW_MAP[e.key], true);
        return;
      }
      // Escape → toggle navigate (none) mode
      if (e.key === 'Escape') {
        handleSetToolMode(toolModeRef.current === 'none' ? 'paint' : 'none');
        return;
      }
      // Numeric keys → entity selection
      const idx = parseInt(e.key) - 1;
      if (isNaN(idx) || idx < 0) return;
      if (idx < entities.length) handleSelectType(entities[idx].id);
      else if (idx === entities.length) handleSelectType(0);
    };

    const upHandler = (e) => {
      if (e.key in ARROW_MAP) {
        engineRef.current?.setButtonState(ARROW_MAP[e.key], false);
      }
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
      // Release all buttons on unmount
      for (let k = 0; k < 4; k++) engineRef.current?.setButtonState(k, false);
    };
  }, [entities, handleSelectType, undo, redo, handleSetToolMode]);

  // Deep-link: ?pack=X-XXXX — auto-load a shared pack on page load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('pack');
    if (!code) return;

    let cancelled = false;
    fetch(`/api/load?code=${encodeURIComponent(code)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Pack "${code}" not found (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (!json || !Array.isArray(json.entities)) {
          console.warn('[PixelPlanet] Deep-link pack has unexpected format, ignoring.');
          return;
        }
        importConfig({
          entities:    json.entities,
          globalRules: json.globalRules ?? [],
          entityRules: json.entityRules ?? {},
        });
        // Clean the pack param from the URL so refreshing doesn't re-load.
        const url = new URL(window.location.href);
        url.searchParams.delete('pack');
        window.history.replaceState(null, '', url.toString());
      })
      .catch((err) => {
        if (!cancelled) console.warn('[PixelPlanet] Deep-link load failed:', err.message);
      });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '90vh', background: '#0d0d16' }}>
      {/* ── Mobile layout ─────────────────────────────────────────────── */}
      {isMobile ? (
        <>
        <Toolbar
            isPaused={isPaused}
            speedIdx={speedIdx}
            speeds={SPEEDS}
            onTogglePause={handleTogglePause}
            onSpeedUp={handleSpeedUp}
            onSlowDown={handleSlowDown}
            onClear={handleClear}
            onStep={handleStep}
            onExport={handleExport}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          {/* Canvas fills all space above the HUD */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <SimCanvas
              selectedTypeRef={selectedTypeRef}
              brushSizeRef={brushSizeRef}
              isPausedRef={isPausedRef}
              tickRateRef={tickRateRef}
              clearCanvasRef={clearCanvasRef}
              stepCanvasRef={stepCanvasRef}
              exportCanvasRef={exportCanvasRef}
              toolModeRef={toolModeRef}
              onSelectType={handleSelectType}
              engineRef={engineRef}
            />
            <ScoreDisplay
              score={score}
              gameState={gameState}
              onRestart={() => engineRef.current?.resetGame()}
            />
            {hasButtonRules() && <GameController engineRef={engineRef} />}
          </div>

          {/* Bottom HUD */}
          <MobileHUD
            selectedType={selectedType}
            onSelectType={handleSelectType}
            brushSize={brushSize}
            onBrushSize={handleBrushSize}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onClear={handleClear}
            onOpenEditor={() => setSidebarOpen(true)}
            toolMode={toolMode}
            onSetToolMode={handleSetToolMode}
          />

          {/* Sidebar overlay (drawer) */}
          {sidebarOpen && (
            <Sidebar
              selectedType={selectedType}
              onSelectType={handleSelectType}
              isMobile
              onClose={() => setSidebarOpen(false)}
            />
          )}
        </>
      ) : (
        /* ── Desktop layout ───────────────────────────────────────────── */
        <>
          <Toolbar
            isPaused={isPaused}
            speedIdx={speedIdx}
            speeds={SPEEDS}
            onTogglePause={handleTogglePause}
            onSpeedUp={handleSpeedUp}
            onSlowDown={handleSlowDown}
            onClear={handleClear}
            onStep={handleStep}
            onExport={handleExport}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <Sidebar selectedType={selectedType} onSelectType={handleSelectType} />
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <SimCanvas
                selectedTypeRef={selectedTypeRef}
                brushSizeRef={brushSizeRef}
                isPausedRef={isPausedRef}
                tickRateRef={tickRateRef}
                clearCanvasRef={clearCanvasRef}
                stepCanvasRef={stepCanvasRef}
                exportCanvasRef={exportCanvasRef}
                toolModeRef={toolModeRef}
                onSelectType={handleSelectType}
                engineRef={engineRef}
              />
              <ScoreDisplay
                score={score}
                gameState={gameState}
                onRestart={() => engineRef.current?.resetGame()}
              />
              {hasButtonRules() && <GameController engineRef={engineRef} />}
            </div>
            <PixelPalette
              selectedType={selectedType}
              onSelectType={handleSelectType}
              brushSize={brushSize}
              onBrushSize={handleBrushSize}
              toolMode={toolMode}
              onSetToolMode={handleSetToolMode}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SimProvider>
      <AppInner />
    </SimProvider>
  );
}
