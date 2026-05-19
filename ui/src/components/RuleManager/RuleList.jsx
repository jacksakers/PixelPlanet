/**
 * RuleManager/RuleList.jsx
 *
 * Scrollable list of rules (global or entity-scoped).
 * Props:
 *   rules         – Rule[]
 *   selectedId    – string | null
 *   onSelect      – (id: string) => void
 *   onDelete      – (id: string) => void
 *   onAdd         – () => void
 *   onCopy        – (id: string) => void  (optional; shows copy button)
 *   onMoveUp      – (id: string) => void  (optional; shows reorder buttons)
 *   onMoveDown    – (id: string) => void  (optional; shows reorder buttons)
 */

const S = {
  row: (selected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    background: selected ? '#2d2d48' : 'transparent',
    border: selected ? '1px solid #5566aa' : '1px solid transparent',
  }),
  id: { flex: 1, fontSize: '0.8rem', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  trigger: { fontSize: '0.7rem', color: '#556', flexShrink: 0 },
  iconBtn: {
    background: 'none', border: 'none', color: '#556', cursor: 'pointer',
    fontSize: '0.78rem', padding: '0 3px', flexShrink: 0,
  },
  orderBtn: {
    background: 'none', border: '1px solid #2a2a3a', borderRadius: 3, color: '#557', cursor: 'pointer',
    fontSize: '0.7rem', padding: '0 3px', flexShrink: 0, lineHeight: '16px',
  },
  del: {
    background: 'none', border: 'none', color: '#774', cursor: 'pointer',
    fontSize: '0.8rem', padding: '0 4px', flexShrink: 0,
  },
  addBtn: {
    marginTop: 6,
    padding: '4px 10px',
    background: '#252538',
    border: '1px solid #3a3a55',
    borderRadius: 6,
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '0.78rem',
  },
};

export default function RuleList({ rules, selectedId, onSelect, onDelete, onAdd, onCopy, onMoveUp, onMoveDown }) {
  const showOrder = !!(onMoveUp && onMoveDown);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rules.length === 0 && (
        <p style={{ fontSize: '0.78rem', color: '#444', margin: '4px 0' }}>No rules defined.</p>
      )}
      {rules.map((r, idx) => (
        <div key={r.id} style={S.row(r.id === selectedId)} onClick={() => onSelect(r.id)}>
          {showOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
              <button
                style={{ ...S.orderBtn, opacity: idx === 0 ? 0.25 : 1 }}
                disabled={idx === 0}
                title="Move rule up"
                onClick={(e) => { e.stopPropagation(); onMoveUp(r.id); }}
              >▲</button>
              <button
                style={{ ...S.orderBtn, opacity: idx === rules.length - 1 ? 0.25 : 1 }}
                disabled={idx === rules.length - 1}
                title="Move rule down"
                onClick={(e) => { e.stopPropagation(); onMoveDown(r.id); }}
              >▼</button>
            </div>
          )}
          <span style={S.id}>{r.title || r.id || '(unnamed)'}</span>
          <span style={S.trigger}>{r.trigger}</span>
          {onCopy && (
            <button
              style={S.iconBtn}
              title="Copy rule to another entity"
              onClick={(e) => { e.stopPropagation(); onCopy(r.id); }}
            >
              ⎘
            </button>
          )}
          <button
            style={S.del}
            title="Delete rule"
            onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
          >
            ✕
          </button>
        </div>
      ))}
      <button style={S.addBtn} onClick={onAdd}>+ New Rule</button>
    </div>
  );
}
