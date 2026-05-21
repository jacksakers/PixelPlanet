/**
 * RuleManager/index.jsx
 *
 * Two-tab panel: "Global Rules" and "Entity Rules".
 * Global rules apply to every pixel matching the condition.
 * Entity rules are scoped to a specific entity type.
 */

import { useState, useEffect } from 'react';
import { useSimContext } from '../../store/SimContext.jsx';
import { newRuleId }     from '../../shared/defaults.js';
import RuleList          from './RuleList.jsx';
import RuleEditor        from './RuleEditor.jsx';

const TAB_GLOBAL = 'global';
const TAB_ENTITY = 'entity';

const S = {
  tabs: { display: 'flex', gap: 4, marginBottom: 10 },
  tab: (active) => ({
    padding: '4px 12px',
    borderRadius: 6,
    border: active ? '1px solid #5566aa' : '1px solid #2a2a3a',
    background: active ? '#2d2d48' : 'transparent',
    color: active ? '#aaccff' : '#666',
    cursor: 'pointer',
    fontSize: '0.78rem',
  }),
  sel: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '4px 8px',
    fontSize: '0.8rem',
    width: '100%',
    marginBottom: 8,
  },
  jsonBtn: (active) => ({
    padding: '3px 10px',
    background: active ? '#1e2e1e' : 'none',
    border: `1px solid ${active ? '#446644' : '#3a3a55'}`,
    borderRadius: 5,
    color: active ? '#88cc88' : '#666',
    cursor: 'pointer',
    fontSize: '0.72rem',
    marginLeft: 'auto',
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
    minHeight: 200,
  },
  jsonError: {
    fontSize: '0.72rem',
    color: '#cc5555',
    marginTop: 2,
  },
  applyBtn: {
    padding: '4px 12px',
    background: '#1e2e1e',
    border: '1px solid #446644',
    borderRadius: 5,
    color: '#88cc88',
    cursor: 'pointer',
    fontSize: '0.78rem',
    alignSelf: 'flex-start',
  },
};

export default function RuleManager({ selectedType }) {
  const {
    entities,
    globalRules,
    entityRules,
    addGlobalRule,
    updateGlobalRule,
    deleteGlobalRule,
    reorderGlobalRules,
    addEntityRule,
    updateEntityRule,
    deleteEntityRule,
    reorderEntityRules,
    undoVersion,
  } = useSimContext();

  const [tab, setTab]             = useState(TAB_ENTITY);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [editing, setEditing]     = useState(false);
  const [editingNew, setEditingNew] = useState(false);
  const [entityId, setEntityId]   = useState(entities[0]?.id ?? null);
  const [copyingRuleId, setCopyingRuleId] = useState(null);
  const [copyTargetId, setCopyTargetId]   = useState(null);
  const [jsonMode, setJsonMode]   = useState(false);
  const [jsonText, setJsonText]   = useState('');
  const [jsonError, setJsonError] = useState('');

  // Sync entity selection when right panel changes
  useEffect(() => {
    if (selectedType && selectedType > 0) {
      setTab(TAB_ENTITY);
      setEntityId(selectedType);
      setEditing(false);
      setSelectedRuleId(null);
    }
  }, [selectedType]);

  // ── Resolve currently displayed rule list ───────────────────────────────
  const ruleList = tab === TAB_GLOBAL
    ? globalRules
    : (entityRules[entityId] ?? []);

  const selectedRule = ruleList.find((r) => r.id === selectedRuleId) ?? null;

  // Keep JSON textarea in sync when entering JSON mode
  useEffect(() => {
    if (jsonMode) {
      setJsonText(JSON.stringify(ruleList, null, 2));
      setJsonError('');
    }
  }, [jsonMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reorder helpers ────────────────────────────────────────────────────
  function move(list, id, delta) {
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return list;
    const next = [...list];
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= next.length) return list;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    return next;
  }

  function handleMoveUp(id) {
    const next = move(ruleList, id, -1);
    if (tab === TAB_GLOBAL) reorderGlobalRules(next);
    else                    reorderEntityRules(entityId, next);
  }

  function handleMoveDown(id) {
    const next = move(ruleList, id, 1);
    if (tab === TAB_GLOBAL) reorderGlobalRules(next);
    else                    reorderEntityRules(entityId, next);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSelect(id) {
    setSelectedRuleId(id);
    setEditing(true);
    setEditingNew(false);
  }

  function handleAddNew() {
    setSelectedRuleId(null);
    setEditing(true);
    setEditingNew(true);
  }

  function handleCopyRule(id) {
    setCopyingRuleId(id);
    const other = entities.find((e) => e.id !== entityId);
    setCopyTargetId(other?.id ?? entityId);
  }

  function handleConfirmCopy() {
    const rule = ruleList.find((r) => r.id === copyingRuleId);
    if (rule && copyTargetId != null) {
      addEntityRule(copyTargetId, { ...rule, id: newRuleId(rule.id) });
    }
    setCopyingRuleId(null);
    setCopyTargetId(null);
  }

  function handleSave(rule) {
    if (editingNew) {
      const finalRule = { ...rule, id: rule.id || newRuleId() };
      if (tab === TAB_GLOBAL) addGlobalRule(finalRule);
      else                    addEntityRule(entityId, finalRule);
      setSelectedRuleId(finalRule.id);
    } else {
      if (tab === TAB_GLOBAL) updateGlobalRule(rule);
      else                    updateEntityRule(entityId, rule);
    }
    setEditing(true);
    setEditingNew(false);
  }

  function handleDelete(id) {
    if (tab === TAB_GLOBAL) deleteGlobalRule(id);
    else                    deleteEntityRule(entityId, id);
    if (selectedRuleId === id) {
      setSelectedRuleId(null);
      setEditing(false);
    }
  }

  // ── JSON bulk edit ────────────────────────────────────────────────────────
  function handleApplyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) { setJsonError('Must be a JSON array of rules.'); return; }
      if (tab === TAB_GLOBAL) reorderGlobalRules(parsed);
      else                    reorderEntityRules(entityId, parsed);
      setJsonError('');
      setJsonMode(false);
    } catch (e) {
      setJsonError(String(e));
    }
  }

  function handleToggleJson() {
    const next = !jsonMode;
    setJsonMode(next);
    if (next) setEditing(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tabs + JSON toggle */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 4 }}>
        <div style={S.tabs}>
          <button style={S.tab(tab === TAB_GLOBAL)} onClick={() => { setTab(TAB_GLOBAL); setEditing(false); setJsonMode(false); }}>
            Global
          </button>
          <button style={S.tab(tab === TAB_ENTITY)} onClick={() => { setTab(TAB_ENTITY); setEditing(false); setJsonMode(false); }}>
            Entity
          </button>
        </div>
        <button style={S.jsonBtn(jsonMode)} onClick={handleToggleJson} title="Edit all rules as raw JSON">
          {'{}'} JSON
        </button>
      </div>

      {/* Entity selector (only for entity tab) */}
      {tab === TAB_ENTITY && !entityId && (
        <p style={{ fontSize: '0.8rem', color: '#445', textAlign: 'center', marginBottom: 8 }}>
          Select a pixel from the right panel.
        </p>
      )}
      {tab === TAB_ENTITY && entityId && (() => {
        const ent = entities.find((e) => e.id === entityId);
        return ent ? (
          <div style={{ fontSize: '0.74rem', color: '#667', marginBottom: 6, padding: '3px 6px', background: '#1a1a2e', borderRadius: 5, border: '1px solid #2a2a3a' }}>
            {ent.name}
          </div>
        ) : null;
      })()}

      {/* JSON bulk editor */}
      {jsonMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '0.72rem', color: '#667' }}>
            Edit the rule array directly. Paste, reorder, or duplicate rules. Apply when done.
          </span>
          <textarea
            style={S.textarea}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <span style={S.jsonError}>{jsonError}</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={S.applyBtn} onClick={handleApplyJson}>Apply JSON</button>
            <button
              onClick={() => { setJsonMode(false); setJsonError(''); }}
              style={{ padding: '4px 10px', background: 'none', border: '1px solid #3a3a55', borderRadius: 5, color: '#888', cursor: 'pointer', fontSize: '0.78rem' }}
            >Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {/* Rule list */}
          <RuleList
            rules={ruleList}
            selectedId={editing && !editingNew ? selectedRuleId : null}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onAdd={handleAddNew}
            onCopy={tab === TAB_ENTITY ? handleCopyRule : undefined}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />

          {/* Copy rule picker */}
          {copyingRuleId && (
            <div style={{
              background: '#1c1c30', border: '1px solid #4455aa', borderRadius: 8,
              padding: '10px 12px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ fontSize: '0.75rem', color: '#aaccff' }}>Copy rule to entity:</span>
              <select
                style={S.sel}
                value={copyTargetId ?? ''}
                onChange={(e) => setCopyTargetId(Number(e.target.value))}
              >
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name} (ID {e.id})</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleConfirmCopy}
                  style={{ padding: '3px 12px', background: '#2a3a5a', border: '1px solid #4466aa', borderRadius: 5, color: '#aaccff', cursor: 'pointer', fontSize: '0.78rem' }}
                >Copy</button>
                <button
                  onClick={() => { setCopyingRuleId(null); setCopyTargetId(null); }}
                  style={{ padding: '3px 10px', background: 'none', border: '1px solid #3a3a55', borderRadius: 5, color: '#888', cursor: 'pointer', fontSize: '0.78rem' }}
                >Cancel</button>
              </div>
            </div>
          )}

          {/* Rule editor */}
          {editing && (
            <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 12, marginTop: 10 }}>
              <RuleEditor
                key={`${editingNew ? '__new__' : (selectedRuleId ?? '__none__')}_u${undoVersion}`}
                rule={editingNew ? null : selectedRule}
                onSave={handleSave}
                onCancel={() => { setEditing(false); setSelectedRuleId(null); }}
                entityId={tab === TAB_ENTITY ? entityId : null}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
