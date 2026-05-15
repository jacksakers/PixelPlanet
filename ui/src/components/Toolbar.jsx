import { PIXEL_EMPTY, PIXEL_SAND, PIXEL_WATER, PIXEL_STONE } from './SimCanvas.jsx';

const TOOLS = [
  { type: PIXEL_SAND,  label: 'Sand',  color: '#dbb63c', key: '1' },
  { type: PIXEL_WATER, label: 'Water', color: '#1e64dc', key: '2' },
  { type: PIXEL_STONE, label: 'Stone', color: '#787882', key: '3' },
  { type: PIXEL_EMPTY, label: 'Erase', color: '#333344', key: '4' },
];

/**
 * Toolbar
 * Props:
 *   selectedType      - number  (currently selected pixel type)
 *   onSelectType      - (type: number) => void
 */
export default function Toolbar({ selectedType, onSelectType }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: '0.5rem',
      padding: '0.6rem 1rem',
      background: '#1a1a26',
      borderBottom: '1px solid #2a2a3a',
      alignItems: 'center',
      userSelect: 'none',
    }}>
      <span style={{ fontSize: '0.75rem', color: '#888', marginRight: '0.25rem', letterSpacing: '0.05em' }}>
        PIXEL PLANET
      </span>

      <div style={{ width: 1, height: 24, background: '#2a2a3a', margin: '0 0.25rem' }} />

      {TOOLS.map(({ type, label, color, key }) => {
        const active = selectedType === type;
        return (
          <button
            key={type}
            title={`${label} [${key}]`}
            onClick={() => onSelectType(type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.3rem 0.75rem',
              background: active ? '#2d2d44' : 'transparent',
              border: active ? `1px solid ${color}` : '1px solid transparent',
              borderRadius: 6,
              color: active ? '#fff' : '#aaa',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'all 0.12s',
            }}
          >
            <span style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: type === PIXEL_EMPTY ? 2 : 2,
              background: color,
              border: type === PIXEL_EMPTY ? '1px solid #555' : 'none',
            }} />
            {label}
            <span style={{ color: '#555', fontSize: '0.7rem' }}>{key}</span>
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: '0.7rem', color: '#444' }}>
        Phase 1 - Falling Sand Demo
      </span>
    </div>
  );
}
