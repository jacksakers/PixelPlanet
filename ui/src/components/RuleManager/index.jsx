/**
 * RuleManager/index.jsx
 *
 * Two-tab panel: "Global Rules" and "Entity Rules".
 * Global rules apply to every pixel matching the condition.
 * Entity rules are scoped to a specific entity type.
 */

import { useState } from 'react';
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
};

export default function RuleManager() {
  const {
    entities,
    globalRules,
    entityRules,
    addGlobalRule,
    updateGlobalRule,
    deleteGlobalRule,
    addEntityRule,
    updateEntityRule,
    deleteEntityRule,
  } = useSimContext();

  const [tab, setTab]             = useState(TAB_GLOBAL);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [editing, setEditing]     = useState(false);
  const [editingNew, setEditingNew] = useState(false);
  const [entityId, setEntityId]   = useState(entities[0]?.id ?? null);
  const [copyingRuleId, setCopyingRuleId] = useState(null); // id of rule being copied
  const [copyTargetId, setCopyTargetId]   = useState(null); // target entity for copy

  // ── Resolve currently displayed rule list ───────────────────────────────
  const ruleList = tab === TAB_GLOBAL
    ? globalRules
    : (entityRules[entityId] ?? []);

  const selectedRule = ruleList.find((r) => r.id === selectedRuleId) ?? null;

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
    // Pre-select first other entity as copy target
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
      // Ensure unique id
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tabs */}
      <div style={S.tabs}>
        <button style={S.tab(tab === TAB_GLOBAL)} onClick={() => { setTab(TAB_GLOBAL); setEditing(false); }}>
          Global
        </button>
        <button style={S.tab(tab === TAB_ENTITY)} onClick={() => { setTab(TAB_ENTITY); setEditing(false); }}>
          Entity
        </button>
      </div>

      {/* Entity selector (only for entity tab) */}
      {tab === TAB_ENTITY && (
        <select
          style={S.sel}
          value={entityId ?? ''}
          onChange={(e) => { setEntityId(Number(e.target.value)); setEditing(false); setSelectedRuleId(null); }}
        >
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      )}

      {/* Rule list */}
      <RuleList
        rules={ruleList}
        selectedId={editing && !editingNew ? selectedRuleId : null}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onAdd={handleAddNew}
        onCopy={tab === TAB_ENTITY ? handleCopyRule : undefined}
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
            rule={editingNew ? null : selectedRule}
            onSave={handleSave}
            onCancel={() => { setEditing(false); setSelectedRuleId(null); }}
            entityId={tab === TAB_ENTITY ? entityId : null}
          />
        </div>
      )}
    </div>
  );
}
