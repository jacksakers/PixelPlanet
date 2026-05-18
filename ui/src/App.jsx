import { useRef, useState, useEffect, useCallback } from 'react';
import SimCanvas, { PIXEL_SAND } from './components/SimCanvas.jsx';
import Toolbar   from './components/Toolbar.jsx';
import Sidebar   from './components/Sidebar.jsx';
import { SimProvider, useSimContext } from './store/SimContext.jsx';

// Inner app component (needs access to context for keyboard shortcuts).
function AppInner() {
  const [selectedType, setSelectedType] = useState(PIXEL_SAND);
  const selectedTypeRef = useRef(PIXEL_SAND);
  const [brushSize, setBrushSize] = useState(3);
  const brushSizeRef = useRef(3);
  const { entities } = useSimContext();

  const handleSelectType = useCallback((type) => {
    selectedTypeRef.current = type;
    setSelectedType(type);
  }, []);

  const handleBrushSize = useCallback((size) => {
    brushSizeRef.current = size;
    setBrushSize(size);
  }, []);

  // Keyboard shortcuts — keys 1-9 map to entity IDs in order, last key = erase.
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const idx = parseInt(e.key) - 1;
      if (isNaN(idx) || idx < 0) return;
      if (idx < entities.length) handleSelectType(entities[idx].id);
      else if (idx === entities.length) handleSelectType(0); // erase
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [entities, handleSelectType]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d16' }}>
      <Toolbar selectedType={selectedType} onSelectType={handleSelectType} brushSize={brushSize} onBrushSize={handleBrushSize} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar selectedType={selectedType} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SimCanvas selectedTypeRef={selectedTypeRef} brushSizeRef={brushSizeRef} />
        </div>
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
