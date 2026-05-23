/**
 * PackManager.jsx
 *
 * Named snapshots of the full simulation config (entities + rules).
 * Packs are stored in localStorage under PACKS_STORAGE_KEY.
 *
 * Features:
 *  - Save current state as a named pack
 *  - List all saved packs with timestamps
 *  - Load a pack (replaces current config)
 *  - Delete a pack
 *  - Share pack via short code (api/save → Supabase)
 *  - Load pack by short code (api/load ← Supabase)
 */

import { useState, useCallback } from 'react';
import { useSimContext } from '../store/SimContext.jsx';
import {
  loadPacks,
  savePack,
  deletePack,
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
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    borderRadius: 6,
    background: '#1a1a2e',
    border: '1px solid #2a2a3a',
  },
  packName: {
    flex: 1,
    fontSize: '0.82rem',
    color: '#ccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: '0.68rem',
    color: '#445',
    flexShrink: 0,
  },
  btn: (variant) => ({
    padding: '3px 9px',
    background: variant === 'load'  ? '#1e2840' :
                variant === 'del'   ? 'none'    : '#252538',
    border: `1px solid ${variant === 'load' ? '#4466aa' : variant === 'del' ? '#552222' : '#3a3a55'}`,
    borderRadius: 5,
    color: variant === 'load'  ? '#88aaee' :
           variant === 'del'   ? '#aa4444' : '#aaa',
    cursor: 'pointer',
    fontSize: '0.74rem',
    flexShrink: 0,
  }),
  inp: {
    flex: 1,
    background: '#1a1a2e',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#ddd',
    padding: '4px 7px',
    fontSize: '0.82rem',
    outline: 'none',
    minWidth: 0,
  },
  saveBtn: {
    padding: '4px 12px',
    background: '#1e2e1e',
    border: '1px solid #446644',
    borderRadius: 5,
    color: '#88cc88',
    cursor: 'pointer',
    fontSize: '0.78rem',
    flexShrink: 0,
  },
  status: (ok) => ({
    fontSize: '0.72rem',
    color: ok ? '#55aa77' : '#cc5555',
    marginTop: 2,
  }),
  empty: {
    fontSize: '0.78rem',
    color: '#444',
    margin: '4px 0',
  },
  shareSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    background: '#16161f',
    borderRadius: 8,
    border: '1px solid #2a2a3a',
    marginBottom: 10,
  },
  codeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    background: '#0d0d18',
    border: '1px solid #3a4a6a',
    borderRadius: 6,
  },
  code: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '1.05rem',
    letterSpacing: '0.15em',
    color: '#88aaff',
    userSelect: 'all',
  },
  copyBtn: {
    padding: '3px 9px',
    background: '#1e2840',
    border: '1px solid #4466aa',
    borderRadius: 5,
    color: '#88aaee',
    cursor: 'pointer',
    fontSize: '0.74rem',
    flexShrink: 0,
  },
  shareBtn: {
    padding: '4px 12px',
    background: '#1a2440',
    border: '1px solid #4466aa',
    borderRadius: 5,
    color: '#88aaee',
    cursor: 'pointer',
    fontSize: '0.78rem',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  loadCodeBtn: {
    padding: '4px 12px',
    background: '#1e2e1e',
    border: '1px solid #446644',
    borderRadius: 5,
    color: '#88cc88',
    cursor: 'pointer',
    fontSize: '0.78rem',
    flexShrink: 0,
  },
};

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function PackManager() {
  const { entities, globalRules, entityRules, importConfig } = useSimContext();

  const [packs, setPacks]       = useState(() => loadPacks());
  const [newName, setNewName]   = useState('');
  const [status, setStatus]     = useState(null);   // { ok, msg }
  const [confirmId, setConfirmId] = useState(null); // pack id pending deletion confirm

  // ── Cloud sharing state ──────────────────────────────────────────────────
  const [shareCode, setShareCode]       = useState('');   // code returned after upload
  const [isSharing, setIsSharing]       = useState(false);
  const [loadCode, setLoadCode]         = useState('');   // user-typed code
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  // Upload current config → api/save → display short code
  const handleShare = useCallback(async () => {
    setIsSharing(true);
    setShareCode('');
    setStatus(null);
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entities, globalRules, entityRules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');
      setShareCode(json.code);
      setStatus({ ok: true, msg: 'Pack uploaded! Share the code below.' });
    } catch (err) {
      setStatus({ ok: false, msg: `Upload failed: ${err.message}` });
    } finally {
      setIsSharing(false);
    }
  }, [entities, globalRules, entityRules]);

  // Copy code to clipboard
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(shareCode).then(() => {
      setStatus({ ok: true, msg: 'Code copied to clipboard!' });
    }).catch(() => {
      setStatus({ ok: false, msg: 'Could not copy — select the code manually.' });
    });
  }, [shareCode]);

  // Fetch pack by code from api/load → inject into engine
  const handleLoadByCode = useCallback(async () => {
    const code = loadCode.trim().toUpperCase();
    if (!code) return;
    setIsLoadingCode(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/load?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');
      importConfig({
        entities:    json.entities    ?? [],
        globalRules: json.globalRules ?? [],
        entityRules: json.entityRules ?? {},
      });
      setLoadCode('');
      setStatus({ ok: true, msg: `Pack "${code}" loaded.` });
    } catch (err) {
      setStatus({ ok: false, msg: `Load failed: ${err.message}` });
    } finally {
      setIsLoadingCode(false);
    }
  }, [loadCode, importConfig]);

  function handleSave() {
    const name = newName.trim() || `Pack ${packs.length + 1}`;
    const next = savePack(name, entities, globalRules, entityRules);
    setPacks(next);
    setNewName('');
    setStatus({ ok: true, msg: `Saved "${name}".` });
  }

  function handleLoad(pack) {
    importConfig({
      entities:    pack.entities,
      globalRules: pack.globalRules,
      entityRules: pack.entityRules,
    });
    setStatus({ ok: true, msg: `Loaded "${pack.name}".` });
  }

  function handleDelete(id) {
    if (confirmId !== id) { setConfirmId(id); return; }
    const next = deletePack(id);
    setPacks(next);
    setConfirmId(null);
    setStatus({ ok: true, msg: 'Pack deleted.' });
  }

  return (
    <>
      {/* ── Cloud share: upload current pack ──────────────────────── */}
      <div style={S.shareSection}>
        <span style={S.title}>Share Pack</span>
        <button
          style={{ ...S.shareBtn, opacity: isSharing ? 0.6 : 1 }}
          onClick={handleShare}
          disabled={isSharing}
        >
          {isSharing ? 'Uploading…' : '☁ Upload &amp; Get Code'}
        </button>
        {shareCode && (
          <div style={S.codeDisplay}>
            <span style={S.code}>{shareCode}</span>
            <button style={S.copyBtn} onClick={handleCopyCode}>Copy</button>
          </div>
        )}
      </div>

      {/* ── Cloud load: fetch by short code ───────────────────────── */}
      <div style={S.shareSection}>
        <span style={S.title}>Load by Code</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ ...S.inp, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            value={loadCode}
            onChange={(e) => setLoadCode(e.target.value)}
            placeholder="e.g. P-X7K9"
            maxLength={6}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLoadByCode(); }}
          />
          <button
            style={{ ...S.loadCodeBtn, opacity: isLoadingCode ? 0.6 : 1 }}
            onClick={handleLoadByCode}
            disabled={isLoadingCode || !loadCode.trim()}
          >
            {isLoadingCode ? 'Loading…' : 'Load'}
          </button>
        </div>
      </div>

      {/* ── Local packs ───────────────────────────────────────────── */}
      <div style={S.section}>
        <span style={S.title}>Packs</span>

        {/* Save current config */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={S.inp}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Pack name…"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          <button style={S.saveBtn} onClick={handleSave}>Save</button>
        </div>

        {/* Pack list */}
        {packs.length === 0 ? (
          <p style={S.empty}>No packs saved yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {packs.map((pack) => (
              <div key={pack.id} style={S.row}>
                <span style={S.packName} title={pack.name}>{pack.name}</span>
                <span style={S.meta}>{fmtDate(pack.savedAt)}</span>
                <button style={S.btn('load')} onClick={() => handleLoad(pack)}>Load</button>
                {confirmId === pack.id ? (
                  <>
                    <button style={S.btn('del')} onClick={() => handleDelete(pack.id)}>Sure?</button>
                    <button style={S.btn()} onClick={() => setConfirmId(null)}>Cancel</button>
                  </>
                ) : (
                  <button style={S.btn('del')} onClick={() => handleDelete(pack.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {status && <span style={S.status(status.ok)}>{status.msg}</span>}
      </div>
    </>
  );
}
