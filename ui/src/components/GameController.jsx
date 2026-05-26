/**
 * GameController.jsx
 *
 * On-screen D-pad controller that appears automatically when any rule in the
 * current config uses the OnButtonPress trigger.
 *
 * Props:
 *   engineRef  - ref populated by SimCanvas ({setButtonState, ...})
 *
 * Button keys passed to engineRef.setButtonState:
 *   0 = up | 1 = down | 2 = left | 3 = right
 */

const BUTTON_UP    = 0;
const BUTTON_DOWN  = 1;
const BUTTON_LEFT  = 2;
const BUTTON_RIGHT = 3;

const S = {
  root: {
    position: 'absolute',
    bottom: 16,
    right: 45,
    display: 'grid',
    gridTemplateAreas: `
      ".    up   ."
      "left down right"
    `,
    gridTemplateColumns: '44px 44px 44px',
    gridTemplateRows:    '44px 44px',
    gap: 4,
    zIndex: 20,
    userSelect: 'none',
    touchAction: 'none',
    pointerEvents: 'auto',
  },
  btn: (area, pressed) => ({
    gridArea: area,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: pressed ? 'rgba(85,102,170,0.85)' : 'rgba(26,26,46,0.75)',
    border: `1px solid ${pressed ? '#5566aa' : '#3a3a55'}`,
    borderRadius: 9,
    color: pressed ? '#ddeeff' : '#aaccff',
    fontSize: '1.1rem',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.08s',
  }),
};

import { useState, useCallback, useEffect } from 'react';

export default function GameController({ engineRef }) {
  const [pressed, setPressed] = useState({ 0: false, 1: false, 2: false, 3: false });

  const press = useCallback((key) => {
    setPressed((p) => ({ ...p, [key]: true }));
    engineRef.current?.setButtonState(key, true);
  }, [engineRef]);

  const release = useCallback((key) => {
    setPressed((p) => ({ ...p, [key]: false }));
    engineRef.current?.setButtonState(key, false);
  }, [engineRef]);

  // Release all buttons on component unmount or when pointer leaves the doc.
  useEffect(() => {
    const releaseAll = () => {
      for (let k = 0; k < 4; k++) {
        engineRef.current?.setButtonState(k, false);
      }
      setPressed({ 0: false, 1: false, 2: false, 3: false });
    };
    window.addEventListener('pointerup', releaseAll);
    window.addEventListener('pointercancel', releaseAll);
    return () => {
      window.removeEventListener('pointerup', releaseAll);
      window.removeEventListener('pointercancel', releaseAll);
      releaseAll();
    };
  }, [engineRef]);

  function makeBtn(area, key, label) {
    return (
      <button
        style={S.btn(area, pressed[key])}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press(key); }}
        onPointerUp={() => release(key)}
        onPointerCancel={() => release(key)}
        title={['Up', 'Down', 'Left', 'Right'][key]}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={S.root}>
      {makeBtn('up',    BUTTON_UP,    '▲')}
      {makeBtn('left',  BUTTON_LEFT,  '◀')}
      {makeBtn('down',  BUTTON_DOWN,  '▼')}
      {makeBtn('right', BUTTON_RIGHT, '▶')}
    </div>
  );
}
