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
  const [editing, setEditing]     = useState(false);   // show RuleEditor?
  const [editingNew, setEditingNew] = useState(false); // true = creating new rule
  const [entityId, setEntityId]   = useState(entities[0]?.id ?? null);

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
      />

      {/* Rule editor */}
      {editing && (
        <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 12, marginTop: 10 }}>
          <RuleEditor
            rule={editingNew ? null : selectedRule}
            onSave={handleSave}
            onCancel={() => { setEditing(false); setSelectedRuleId(null); }}
          />
        </div>
      )}
    </div>
  );
}
