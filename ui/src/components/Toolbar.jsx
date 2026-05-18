/**
 * Toolbar.jsx
 *
 * Slim top title bar — brand name only.
 * Entity selection and brush size have moved to PixelPalette (right panel).
 */

export default function Toolbar() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0 1rem',
      height: 36,
      background: '#1a1a26',
      borderBottom: '1px solid #2a2a3a',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <span style={{ fontSize: '0.72rem', letterSpacing: '0.12em', color: '#667', fontWeight: 600 }}>
        PIXEL PLANET
      </span>
      <span style={{ width: 1, height: 16, background: '#2a2a3a' }} />
      <span style={{ fontSize: '0.65rem', color: '#334', letterSpacing: '0.06em' }}>PHASE 3</span>
    </div>
  );
}
