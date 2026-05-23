/**
 * SettingsPanel.jsx
 *
 * Settings tab in the Sidebar.
 * Features:
 *  - Clear localStorage (delete saved config)
 *  - Reset to defaults
 *  - Export entity bundle (all or selected)
 *  - Import entity bundle from JSON
 */

import { useState, useRef } from 'react';
import { useSimContext } from '../store/SimContext.jsx';
import PackManager from './PackManager.jsx';
import ShareManager from './ShareManager.jsx';
import {
  exportBundle,
  importBundle,
} from '../shared/defaults.js';

const S = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    background: '#16161f',
    borderRadius: 8,
    border: '1px solid #2a2a3a',
    marginBottom: 10,
  },
  title: {
    fontSize: '0.72rem',
    color: '#666',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  btn: (danger) => ({
    padding: '5px 12px',
    background: danger ? 'none' : '#252538',
    border: `1px solid ${danger ? '#662222' : '#3a3a55'}`,
    borderRadius: 6,
    color: danger ? '#cc5555' : '#aaa',
    cursor: 'pointer',
    fontSize: '0.8rem',
    alignSelf: 'flex-start',
  }),
  sel: {
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ccc',
    padding: '4px 8px',
    fontSize: '0.8rem',
    width: '100%',
  },
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
    minHeight: 80,
  },
  status: (ok) => ({
    fontSize: '0.72rem',
    color: ok ? '#55aa77' : '#cc5555',
    marginTop: 2,
  }),
};

export default function SettingsPanel() {
  const {
    entities,
    globalRules,
    entityRules,
    resetDefaults,
    mergeImport,
    importConfig,
  } = useSimContext();

  const [exportMode, setExportMode]       = useState('all');
  const [exportEntityId, setExportEntityId] = useState(entities[0]?.id ?? null);
  const [exportText, setExportText]       = useState('');
  const [importText, setImportText]       = useState('');
  const [importStatus, setImportStatus]   = useState(null);
  const [confirmReset, setConfirmReset]   = useState(false);

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    if (exportMode === 'all') {
      setExportText(exportBundle(entities, entityRules, globalRules));
    } else {
      const ent = entities.filter((e) => e.id === exportEntityId);
      setExportText(exportBundle(ent, entityRules));
    }
  }

  function handleCopyExport() {
    navigator.clipboard?.writeText(exportText).catch(() => {});
  }

  // ── Import ────────────────────────────────────────────────────────────────
  function handleImport(replace) {
    const result = importBundle(importText, replace ? [] : entities);
    if (!result) {
      setImportStatus({ ok: false, msg: 'Invalid JSON or missing "entities" array.' });
      return;
    }
    if (replace) {
      importConfig(result);
    } else {
      mergeImport(result);
    }
    setImportStatus({ ok: true, msg: `Imported ${result.entities.length} entit${result.entities.length === 1 ? 'y' : 'ies'}.` });
    setImportText('');
  }

  // ── Storage management ────────────────────────────────────────────────────
  function handleReset() {
    resetDefaults();
    setConfirmReset(false);
    setImportStatus({ ok: true, msg: 'Reset to default Sand / Water / Stone.' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Packs ── */}
      <PackManager />

      {/* ── Cloud sharing ── */}
      <ShareManager />

      {/* ── Export ── */}
      <div style={S.section}>
        <span style={S.title}>Export Entities</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select style={{ ...S.sel, width: 'auto', flex: 1 }} value={exportMode} onChange={(e) => setExportMode(e.target.value)}>
            <option value="all">All entities + global rules</option>
            <option value="selected">Single entity</option>
          </select>
          {exportMode === 'selected' && (
            <select style={{ ...S.sel, flex: 1 }} value={exportEntityId ?? ''} onChange={(e) => setExportEntityId(Number(e.target.value))}>
              {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
            </select>
          )}
        </div>
        <button style={S.btn(false)} onClick={handleExport}>Generate JSON</button>
        {exportText && (
          <>
            <textarea
              style={S.textarea}
              value={exportText}
              readOnly
              rows={5}
            />
            <button style={S.btn(false)} onClick={handleCopyExport}>Copy to clipboard</button>
          </>
        )}
      </div>

      {/* ── Import ── */}
      <div style={S.section}>
        <span style={S.title}>Import Entities</span>
        <textarea
          style={S.textarea}
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setImportStatus(null); }}
          placeholder="Paste exported JSON here…"
          rows={5}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.btn(false)} onClick={() => handleImport(false)}>Merge (add)</button>
          <button style={S.btn(true)}  onClick={() => handleImport(true)}>Replace all</button>
        </div>
        {importStatus && (
          <span style={S.status(importStatus.ok)}>{importStatus.msg}</span>
        )}
      </div>

      {/* ── Danger zone ── */}
      <div style={S.section}>
        <span style={S.title}>Danger Zone</span>

        {!confirmReset ? (
          <button style={S.btn(true)} onClick={() => setConfirmReset(true)}>
            Reset to defaults
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#cc8888' }}>Sure? This clears all entities &amp; rules.</span>
            <button style={S.btn(true)} onClick={handleReset}>Yes, reset</button>
            <button style={S.btn(false)} onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        )}
      </div>

    </div>
  );
}
