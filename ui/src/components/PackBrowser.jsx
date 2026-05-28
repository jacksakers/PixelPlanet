/**
 * PackBrowser.jsx
 *
 * Browses community packs stored in Supabase.
 * Fetches from GET /api/browse and lets the user load any pack.
 *
 * Props:
 *   onLoad  (packCode: string) => void  — called with the code to load
 */

import { useState, useEffect, useCallback } from 'react';

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: '0.72rem',
    color: '#666',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  refreshBtn: {
    padding: '3px 9px',
    background: 'none',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: '#666',
    cursor: 'pointer',
    fontSize: '0.72rem',
  },
  status: (ok) => ({
    fontSize: '0.72rem',
    color: ok ? '#55aa77' : '#cc5555',
    marginTop: 2,
  }),
  empty: {
    fontSize: '0.78rem',
    color: '#444',
    padding: '4px 0',
  },
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '7px 10px',
    background: '#16161f',
    border: '1px solid #2a2a3a',
    borderRadius: 7,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: '0.82rem',
    color: '#ccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: '0.66rem',
    color: '#445',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardCode: {
    fontSize: '0.66rem',
    color: '#334',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
    marginTop: 2,
  },
  loadBtn: {
    padding: '4px 10px',
    background: '#1e2840',
    border: '1px solid #4466aa',
    borderRadius: 5,
    color: '#88aaee',
    cursor: 'pointer',
    fontSize: '0.74rem',
    flexShrink: 0,
    alignSelf: 'center',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
  },
  pageBtn: (disabled) => ({
    padding: '3px 10px',
    background: 'none',
    border: '1px solid #3a3a55',
    borderRadius: 5,
    color: disabled ? '#333' : '#777',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '0.72rem',
  }),
  pageMeta: {
    fontSize: '0.68rem',
    color: '#445',
  },
  spinner: {
    fontSize: '0.78rem',
    color: '#445',
    padding: '8px 0',
  },
};

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch (_) {
    return '';
  }
}

const PAGE_SIZE = 10;

export default function PackBrowser({ onLoad }) {
  const [packs,   setPacks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(null); // { ok, msg }
  const [offset,  setOffset]  = useState(0);
  const [total,   setTotal]   = useState(0);

  const fetchPacks = useCallback(async (off = 0) => {
    setLoading(true);
    setStatus(null);
    try {
      const res  = await fetch(`/api/browse?limit=${PAGE_SIZE}&offset=${off}`);
      const json = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: json.error ?? 'Failed to load packs' });
        return;
      }
      setPacks(json.packs ?? []);
      setTotal(json.total ?? 0);
      setOffset(off);
    } catch (err) {
      setStatus({ ok: false, msg: `Network error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    fetchPacks(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.sectionLabel}>Community Packs</span>
        <button style={S.refreshBtn} onClick={() => fetchPacks(0)} disabled={loading}>
          ↺ Refresh
        </button>
      </div>

      {loading && <div style={S.spinner}>Loading…</div>}
      {status  && <div style={S.status(status.ok)}>{status.msg}</div>}

      {!loading && packs.length === 0 && !status && (
        <p style={S.empty}>No shared packs found yet. Be the first to share one!</p>
      )}

      {packs.map((p) => (
        <div key={p.short_code} style={S.card}>
          <div style={S.cardBody}>
            <div style={S.cardTitle} title={p.title}>{p.title}</div>
            <div style={S.cardMeta}>
              {p.entity_count ? `${p.entity_count} entities` : ''}
              {p.entity_count && p.entity_names.length ? ' — ' : ''}
              {p.entity_names.join(', ')}
            </div>
            <div style={S.cardCode}>{p.short_code} · {fmtDate(p.created_at)}</div>
          </div>
          <button
            style={S.loadBtn}
            onClick={() => onLoad?.(p.short_code)}
          >
            Load
          </button>
        </div>
      ))}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={S.pagination}>
          <button
            style={S.pageBtn(!hasPrev)}
            disabled={!hasPrev}
            onClick={() => fetchPacks(offset - PAGE_SIZE)}
          >← Prev</button>
          <span style={S.pageMeta}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            style={S.pageBtn(!hasNext)}
            disabled={!hasNext}
            onClick={() => fetchPacks(offset + PAGE_SIZE)}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
