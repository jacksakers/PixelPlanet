/**
 * ShareManager.jsx
 *
 * Two-section panel for cloud pack sharing:
 *
 *   ▸ Share — POST current config to /api/save, display the generated
 *             short code (X-XXXX) with a one-click copy button.
 *
 *   ▸ Load  — Enter a short code, GET /api/load?code=, import the
 *             returned pack into the running simulation.
 */

import { useState } from 'react';
import { useSimContext } from '../store/SimContext.jsx';

// ── Styles ────────────────────────────────────────────────────────────────────
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
    gap: 6,
    alignItems: 'center',
  },
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
    fontFamily: 'monospace',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  btn: (variant) => ({
    padding: '4px 11px',
    background:
      variant === 'primary' ? '#1e2e1e' :
      variant === 'copy'    ? '#1e2840' :
      '#252538',
    border: `1px solid ${
      variant === 'primary' ? '#446644' :
      variant === 'copy'    ? '#4466aa' :
      '#3a3a55'
    }`,
    borderRadius: 5,
    color:
      variant === 'primary' ? '#88cc88' :
      variant === 'copy'    ? '#88aaee' :
      '#aaa',
    cursor: 'pointer',
    fontSize: '0.78rem',
    flexShrink: 0,
    lineHeight: '1.4',
  }),
  codeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 9px',
    background: '#0d0d16',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    marginTop: 2,
  },
  code: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '1.1rem',
    letterSpacing: '0.12em',
    color: '#aaccff',
    fontWeight: 700,
  },
  hint: {
    fontSize: '0.68rem',
    color: '#445',
    lineHeight: 1.4,
  },
  status: (ok) => ({
    fontSize: '0.72rem',
    color: ok ? '#55aa77' : '#cc5555',
    marginTop: 2,
  }),
  divider: {
    height: 1,
    background: '#1e1e2e',
    margin: '4px 0',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShareManager() {
  const { entities, globalRules, entityRules, importConfig } = useSimContext();

  // ── Share state ──────────────────────────────────────────────────────────
  const [shareLoading,  setShareLoading]  = useState(false);
  const [shareCode,     setShareCode]     = useState('');    // last generated code
  const [shareStatus,   setShareStatus]   = useState(null);  // { ok, msg }
  const [copied,        setCopied]        = useState(false);

  // ── Load state ───────────────────────────────────────────────────────────
  const [loadInput,     setLoadInput]     = useState('');
  const [loadLoading,   setLoadLoading]   = useState(false);
  const [loadStatus,    setLoadStatus]    = useState(null);  // { ok, msg }

  // ── Share handler ────────────────────────────────────────────────────────

  async function handleShare() {
    setShareLoading(true);
    setShareStatus(null);
    setShareCode('');
    setCopied(false);

    try {
      const payload = JSON.stringify({ entities, globalRules, entityRules });
      const res     = await fetch('/api/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    payload,
      });

      const json = await res.json();

      if (!res.ok) {
        setShareStatus({ ok: false, msg: json.error ?? 'Upload failed' });
        return;
      }

      setShareCode(json.code);
      setShareStatus({ ok: true, msg: 'Pack uploaded! Share this code:' });

      // Auto-update the URL to include ?pack=CODE
      const url = new URL(window.location.href);
      url.searchParams.set('pack', json.code);
      window.history.replaceState(null, '', url.toString());
    } catch (err) {
      setShareStatus({ ok: false, msg: `Network error: ${err.message}` });
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopy() {
    const ok = await copyToClipboard(shareCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ── Load handler ─────────────────────────────────────────────────────────

  async function handleLoad() {
    const code = loadInput.trim().toUpperCase();
    if (!code) {
      setLoadStatus({ ok: false, msg: 'Enter a code first' });
      return;
    }

    setLoadLoading(true);
    setLoadStatus(null);

    try {
      const res  = await fetch(`/api/load?code=${encodeURIComponent(code)}`);
      const json = await res.json();

      if (!res.ok) {
        setLoadStatus({ ok: false, msg: json.error ?? 'Load failed' });
        return;
      }

      // json is the full pack_data object
      if (!json || !Array.isArray(json.entities)) {
        setLoadStatus({ ok: false, msg: 'Received pack has unexpected format' });
        return;
      }

      importConfig({
        entities:    json.entities,
        globalRules: json.globalRules ?? [],
        entityRules: json.entityRules ?? {},
      });

      setLoadStatus({ ok: true, msg: `Pack "${code}" loaded!` });
      setLoadInput('');
    } catch (err) {
      setLoadStatus({ ok: false, msg: `Network error: ${err.message}` });
    } finally {
      setLoadLoading(false);
    }
  }

  return (
    <div style={S.section}>
      <span style={S.title}>Cloud Sharing</span>

      {/* ── Share section ─────────────────────────────────────────────────── */}
      <button
        style={S.btn('primary')}
        onClick={handleShare}
        disabled={shareLoading}
      >
        {shareLoading ? 'Uploading…' : '☁ Share current pack'}
      </button>

      {shareCode && (
        <div style={S.codeDisplay}>
          <span style={S.code}>{shareCode}</span>
          <button style={S.btn('copy')} onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}

      {shareStatus && (
        <span style={S.status(shareStatus.ok)}>{shareStatus.msg}</span>
      )}

      {shareCode && (
        <span style={S.hint}>
          Anyone with this code can load your pack from the Load section below,
          or visit <code>?pack={shareCode}</code> to auto-load it.
        </span>
      )}

      <div style={S.divider} />

      {/* ── Load section ──────────────────────────────────────────────────── */}
      <div style={S.row}>
        <input
          style={S.inp}
          value={loadInput}
          onChange={(e) => setLoadInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLoad(); }}
          placeholder="X-XXXX"
          maxLength={6}
          spellCheck={false}
          aria-label="Short code"
        />
        <button
          style={S.btn()}
          onClick={handleLoad}
          disabled={loadLoading}
        >
          {loadLoading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {loadStatus && (
        <span style={S.status(loadStatus.ok)}>{loadStatus.msg}</span>
      )}
    </div>
  );
}
