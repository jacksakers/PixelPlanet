/**
 * Sidebar.jsx
 *
 * Collapsible left panel containing the Entity Manager and Rule Manager.
 * Uses a simple tab system to switch between the two.
 */

import { useState } from 'react';
import EntityManager from './EntityManager/index.jsx';
import RuleManager   from './RuleManager/index.jsx';
import SettingsPanel from './SettingsPanel.jsx';

const TAB_ENTITIES = 'entities';
const TAB_RULES    = 'rules';
const TAB_SETTINGS = 'settings';

const WIDTH = 360;

const S = {
  sidebar: (collapsed) => ({
    width: collapsed ? 36 : WIDTH,
    minWidth: collapsed ? 36 : WIDTH,
    background: '#131320',
    borderRight: '1px solid #2a2a3a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.18s, min-width 0.18s',
    position: 'relative',
    flexShrink: 0,
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderBottom: '1px solid #2a2a3a',
    flexShrink: 0,
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: '#556',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: 0,
    lineHeight: 1,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #2a2a3a',
    flexShrink: 0,
  },
  tab: (active) => ({
    flex: 1,
    padding: '6px 0',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: active ? '#aaccff' : '#556',
    background: active ? '#1c1c30' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #5566aa' : '2px solid transparent',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  }),
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 10px',
  },
  collapsedStrip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 10,
    gap: 16,
  },
  stripLabel: {
    writingMode: 'vertical-rl',
    textOrientation: 'mixed',
    fontSize: '0.7rem',
    color: '#445',
    letterSpacing: '0.06em',
    transform: 'rotate(180deg)',
    cursor: 'pointer',
    padding: '4px 0',
  },
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState(TAB_ENTITIES);

  if (collapsed) {
    return (
      <div style={S.sidebar(true)}>
        <div style={S.collapsedStrip}>
          <button style={S.collapseBtn} onClick={() => setCollapsed(false)} title="Expand sidebar">
            ▶
          </button>
          <span style={S.stripLabel} onClick={() => setCollapsed(false)}>ENTITIES · RULES</span>
        </div>
      </div>
    );
  }

  return (
    <div style={S.sidebar(false)}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize: '0.72rem', color: '#556', letterSpacing: '0.05em' }}>EDITOR</span>
        <button style={S.collapseBtn} onClick={() => setCollapsed(true)} title="Collapse sidebar">◀</button>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button style={S.tab(tab === TAB_ENTITIES)} onClick={() => setTab(TAB_ENTITIES)}>Entities</button>
        <button style={S.tab(tab === TAB_RULES)}    onClick={() => setTab(TAB_RULES)}>Rules</button>
        <button style={S.tab(tab === TAB_SETTINGS)} onClick={() => setTab(TAB_SETTINGS)}>⚙</button>
      </div>

      {/* Content */}
      <div style={S.content}>
        {tab === TAB_ENTITIES && <EntityManager />}
        {tab === TAB_RULES    && <RuleManager />}
        {tab === TAB_SETTINGS && <SettingsPanel />}
      </div>
    </div>
  );
}
