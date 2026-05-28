/**
 * api/browse.js — Vercel Serverless Function
 *
 * GET /api/browse?sort=recent&limit=20&offset=0
 *
 * Returns a paginated list of packs from the Supabase `packs` table,
 * sorted by creation date (newest first).
 *
 * Each item returned:
 *   { short_code, title, created_at, entity_names }
 *
 * Env vars required (set in Vercel project settings):
 *   SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_LIMIT  = 20;
const MAX_LIMIT      = 50;

module.exports = async function handler(req, res) {
  // CORS headers so the UI can call this from localhost during development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[api/browse] Missing Supabase env vars');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const limit  = Math.min(Math.max(1, parseInt(req.query.limit  ?? DEFAULT_LIMIT, 10) || DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, parseInt(req.query.offset ?? 0, 10) || 0);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  // Select metadata + top-level pack_data fields for previewing, but NOT the
  // full pack_data blob (could be large) — that's fetched on demand via /api/load.
  const { data, error, count } = await supabase
    .from('packs')
    .select('short_code, title, created_at, pack_data->entities', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[api/browse] Supabase error:', error);
    return res.status(500).json({ error: 'Database error' });
  }

  // Map rows: extract entity names for a compact preview
  const packs = (data ?? []).map((row) => {
    const entities = Array.isArray(row.entities) ? row.entities : [];
    return {
      short_code:   row.short_code,
      title:        row.title ?? 'Untitled Pack',
      created_at:   row.created_at,
      entity_names: entities.slice(0, 6).map((e) => e?.name ?? '').filter(Boolean),
      entity_count: entities.length,
    };
  });

  return res.status(200).json({ packs, total: count ?? 0, offset, limit });
};
