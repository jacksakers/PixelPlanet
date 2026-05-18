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
 */

const S = {
  row: (selected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
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

export default function RuleList({ rules, selectedId, onSelect, onDelete, onAdd, onCopy }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rules.length === 0 && (
        <p style={{ fontSize: '0.78rem', color: '#444', margin: '4px 0' }}>No rules defined.</p>
      )}
      {rules.map((r) => (
        <div key={r.id} style={S.row(r.id === selectedId)} onClick={() => onSelect(r.id)}>
          <span style={S.id}>{r.id || '(unnamed)'}</span>
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
