import { useRef, useState, useEffect, useCallback } from 'react';
import SimCanvas, { PIXEL_SAND } from './components/SimCanvas.jsx';
import Toolbar       from './components/Toolbar.jsx';
import Sidebar       from './components/Sidebar.jsx';
import PixelPalette  from './components/PixelPalette.jsx';
import { SimProvider, useSimContext } from './store/SimContext.jsx';

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const DEFAULT_SPEED_IDX = 2; // 1× speed

// Inner app component (needs access to context for keyboard shortcuts).
function AppInner() {
  const [selectedType, setSelectedType] = useState(PIXEL_SAND);
  const selectedTypeRef = useRef(PIXEL_SAND);
  const [brushSize, setBrushSize] = useState(3);
  const brushSizeRef = useRef(3);
  const { entities } = useSimContext();

  // Simulation controls
  const [isPaused, setIsPaused] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(DEFAULT_SPEED_IDX);
  const isPausedRef   = useRef(false);
  const tickRateRef   = useRef(SPEEDS[DEFAULT_SPEED_IDX]);
  const clearCanvasRef = useRef(null); // set by SimCanvas

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { tickRateRef.current = SPEEDS[speedIdx]; }, [speedIdx]);

  const handleSelectType = useCallback((type) => {
    selectedTypeRef.current = type;
    setSelectedType(type);
  }, []);

  const handleBrushSize = useCallback((size) => {
    brushSizeRef.current = size;
    setBrushSize(size);
  }, []);

  const handleTogglePause = useCallback(() => setIsPaused((p) => !p), []);
  const handleSpeedUp     = useCallback(() => setSpeedIdx((i) => Math.min(i + 1, SPEEDS.length - 1)), []);
  const handleSlowDown    = useCallback(() => setSpeedIdx((i) => Math.max(i - 1, 0)), []);
  const handleClear       = useCallback(() => { clearCanvasRef.current?.(); }, []);

  // Keyboard shortcuts — keys 1-9 map to entity IDs in order, last key = erase.
  // Space = toggle pause.
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      // if (e.code === 'Space') { e.preventDefault(); handleTogglePause(); return; }
      const idx = parseInt(e.key) - 1;
      if (isNaN(idx) || idx < 0) return;
      if (idx < entities.length) handleSelectType(entities[idx].id);
      else if (idx === entities.length) handleSelectType(0); // erase
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [entities, handleSelectType, handleTogglePause]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d16' }}>
      <Toolbar
        isPaused={isPaused}
        speedIdx={speedIdx}
        speeds={SPEEDS}
        onTogglePause={handleTogglePause}
        onSpeedUp={handleSpeedUp}
        onSlowDown={handleSlowDown}
        onClear={handleClear}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar selectedType={selectedType} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SimCanvas
            selectedTypeRef={selectedTypeRef}
            brushSizeRef={brushSizeRef}
            isPausedRef={isPausedRef}
            tickRateRef={tickRateRef}
            clearCanvasRef={clearCanvasRef}
          />
        </div>
        <PixelPalette
          selectedType={selectedType}
          onSelectType={handleSelectType}
          brushSize={brushSize}
          onBrushSize={handleBrushSize}
        />
      </div>
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
