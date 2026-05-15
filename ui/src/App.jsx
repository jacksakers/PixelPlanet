import { useRef, useState, useEffect, useCallback } from 'react';
import SimCanvas, { PIXEL_SAND } from './components/SimCanvas.jsx';
import Toolbar from './components/Toolbar.jsx';

export default function App() {
  const [selectedType, setSelectedType] = useState(PIXEL_SAND);
  // Ref keeps the RAF loop always reading the latest type without needing
  // to be recreated when the user changes tools.
  const selectedTypeRef = useRef(PIXEL_SAND);

  const handleSelectType = useCallback((type) => {
    selectedType; // suppress lint - we intentionally keep both
    selectedTypeRef.current = type;
    setSelectedType(type);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts 1-4
  useEffect(() => {
    const keyMap = { '1': 1, '2': 2, '3': 3, '4': 0 };
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const type = keyMap[e.key];
      if (type !== undefined) handleSelectType(type);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSelectType]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar selectedType={selectedType} onSelectType={handleSelectType} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SimCanvas selectedTypeRef={selectedTypeRef} />
      </div>
    </div>
  );
}
