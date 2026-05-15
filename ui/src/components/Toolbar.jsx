import { useSimContext }     from '../store/SimContext.jsx';
import { PIXEL_EMPTY } from './SimCanvas.jsx';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Toolbar
 * Props:
 *   selectedType   - number  (currently selected pixel type ID)
 *   onSelectType   - (type: number) => void
 */
export default function Toolbar({ selectedType, onSelectType }) {
  const { entities } = useSimContext();

  // Build tool list: all entities + eraser, each bound to a keyboard key.
  const tools = [
    ...entities.map((e, i) => ({
      type:  e.id,
      label: e.name,
      color: `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${e.color[3] / 255})`,
      key:   KEYS[i] ?? '',
    })),
    {
      type:  PIXEL_EMPTY,
      label: 'Erase',
      color: '#222233',
      key:   KEYS[entities.length] ?? '',
    },
  ];

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
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '0.75rem', color: '#888', marginRight: '0.25rem', letterSpacing: '0.05em' }}>
        PIXEL PLANET
      </span>

      <div style={{ width: 1, height: 24, background: '#2a2a3a', margin: '0 0.25rem' }} />

      {tools.map(({ type, label, color, key }) => {
        const active = selectedType === type;
        return (
          <button
            key={type}
            title={key ? `${label} [${key}]` : label}
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
              borderRadius: 2,
              background: color,
              border: type === PIXEL_EMPTY ? '1px solid #555' : 'none',
              flexShrink: 0,
            }} />
            {label}
            {key && <span style={{ color: '#555', fontSize: '0.7rem' }}>{key}</span>}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: '0.7rem', color: '#444' }}>Phase 2</span>
    </div>
  );
}
