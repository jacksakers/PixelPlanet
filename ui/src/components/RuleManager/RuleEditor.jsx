/**
 * RuleManager/RuleEditor.jsx
 *
 * Full editor for a single rule:  trigger → condition → actions.
 * Used for both global rules and entity-specific rules.
 * Includes a JSON toggle for direct editing of the rule object.
 */

import { useState, useEffect } from 'react';
import { TRIGGERS, newRuleId } from '../../shared/defaults.js';
import ConditionEditor from './ConditionEditor.jsx';
import ActionEditor    from './ActionEditor.jsx';

const S = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    background: '#16161f',
    borderRadius: 8,
    border: '1px solid #2a2a3a',
  },
  sectionTitle: {
    fontSize: '0.72rem',
    color: '#666',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sel: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '4px 8px',
    fontSize: '0.8rem',
  },
  inp: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '4px 8px',
    fontSize: '0.8rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  addAction: {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid #3a3a55',
    borderRadius: 6,
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.78rem',
    alignSelf: 'flex-start',
  },
  saveBtn: {
    padding: '5px 14px',
    background: '#2a3a5a',
    border: '1px solid #4466aa',
    borderRadius: 6,
    color: '#aaccff',
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  jsonToggleBtn: (active) => ({
    padding: '3px 9px',
    background: active ? '#1e2e1e' : 'none',
    border: `1px solid ${active ? '#446644' : '#3a3a55'}`,
    borderRadius: 5,
    color: active ? '#88cc88' : '#666',
    cursor: 'pointer',
    fontSize: '0.72rem',
  }),
  textarea: {
    background: '#0d0d16',
    border: '1px solid #2a2a3a',
    borderRadius: 5,
    color: '#ccc',
    padding: '6px 8px',
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: 260,
  },
  jsonError: {
    fontSize: '0.72rem',
    color: '#cc5555',
  },
};

export default function RuleEditor({ rule, onSave, onCancel, entityId }) {
  const [draft, setDraft] = useState(() => ({
    id:        rule?.id        ?? newRuleId(),
    trigger:   rule?.trigger   ?? 'OnTick',
    condition: rule?.condition ?? { type: 'Always' },
    actions:   rule?.actions   ?? [],
  }));
  const [jsonMode, setJsonMode]   = useState(false);
  const [jsonText, setJsonText]   = useState('');
  const [jsonError, setJsonError] = useState('');

  // If the caller swaps the rule prop (e.g., switching selected rule) reset draft.
  useEffect(() => {
    if (rule) {
      const next = {
        id:        rule.id        ?? newRuleId(),
        trigger:   rule.trigger   ?? 'OnTick',
        condition: rule.condition ?? { type: 'Always' },
        actions:   rule.actions   ?? [],
      };
      setDraft(next);
      if (jsonMode) setJsonText(JSON.stringify(next, null, 2));
    }
  }, [rule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggleJson() {
    if (!jsonMode) {
      setJsonText(JSON.stringify(draft, null, 2));
      setJsonError('');
    }
    setJsonMode((v) => !v);
  }

  function handleApplyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      setDraft(parsed);
      setJsonError('');
      setJsonMode(false);
    } catch (e) {
      setJsonError(String(e));
    }
  }

  function addAction() {
    setDraft((d) => ({ ...d, actions: [...d.actions, { type: 'Move', dir: 'down' }] }));
  }
  function updateAction(i, action) {
    setDraft((d) => {
      const next = [...d.actions]; next[i] = action;
      return { ...d, actions: next };
    });
  }
  function deleteAction(i) {
    setDraft((d) => {
      const next = [...d.actions]; next.splice(i, 1);
      return { ...d, actions: next };
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header row: title + JSON toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', color: '#556', letterSpacing: '0.05em' }}>
          {rule ? 'Edit Rule' : 'New Rule'}
        </span>
        <button style={S.jsonToggleBtn(jsonMode)} onClick={handleToggleJson} title="Toggle JSON editor">
          {'{ }'} JSON
        </button>
      </div>

      {jsonMode ? (
        /* ── JSON edit mode ───────────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            style={S.textarea}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <span style={S.jsonError}>{jsonError}</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleApplyJson}
              style={{ padding: '4px 12px', background: '#1e2e1e', border: '1px solid #446644', borderRadius: 5, color: '#88cc88', cursor: 'pointer', fontSize: '0.78rem' }}
            >Apply JSON</button>
            <button
              onClick={() => { setJsonMode(false); setJsonError(''); }}
              style={{ padding: '4px 10px', background: 'none', border: '1px solid #3a3a55', borderRadius: 5, color: '#888', cursor: 'pointer', fontSize: '0.78rem' }}
            >Cancel</button>
          </div>
        </div>
      ) : (
        /* ── Form edit mode ───────────────────────────────────────────────── */
        <>
          {/* ID */}
          <label style={{ fontSize: '0.78rem', color: '#777', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Rule ID
            <input
              style={S.inp}
              value={draft.id}
              onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
              placeholder="unique_rule_id"
            />
          </label>

          {/* Trigger */}
          <div style={S.section}>
            <span style={S.sectionTitle}>Trigger</span>
            <select style={S.sel} value={draft.trigger} onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))}>
              {TRIGGERS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Condition */}
          <div style={S.section}>
            <span style={S.sectionTitle}>Condition</span>
            <ConditionEditor
              condition={draft.condition}
              onChange={(c) => setDraft((d) => ({ ...d, condition: c }))}
              entityId={entityId}
            />
          </div>

          {/* Actions */}
          <div style={S.section}>
            <span style={S.sectionTitle}>Actions (run in order, stop on first movement)</span>
            {draft.actions.map((a, i) => (
              <ActionEditor
                key={i}
                action={a}
                entityId={entityId}
                onChange={(a) => updateAction(i, a)}
                onDelete={() => deleteAction(i)}
              />
            ))}
            <button style={S.addAction} onClick={addAction}>+ Add Action</button>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {onCancel && (
              <button
                onClick={onCancel}
                style={{ ...S.saveBtn, background: 'none', border: '1px solid #3a3a55', color: '#888' }}
              >
                Cancel
              </button>
            )}
            <button style={S.saveBtn} onClick={() => onSave(draft)}>
              {rule ? 'Save Rule' : 'Add Rule'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
