/**
 * api/load.js — Vercel Serverless Function
 *
 * GET /api/load?code=X-XXXX
 *
 * Looks up the short code in the Supabase `packs` table and returns
 * the stored pack_data JSON.
 *
 * Env vars required (set in Vercel project settings):
 *   SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Basic allow-list: the code must match our generated format (X-XXXX).
const CODE_PATTERN = /^[A-Z2-9]-[A-Z2-9]{4}$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Guard: catch missing env vars early with a clear message.
  if (!process.env.SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[api/load] Missing env vars: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return res.status(500).json({ error: 'Server misconfiguration: Supabase env vars not set' });
  }

  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing ?code= parameter' });
  }

  const normalized = code.trim().toUpperCase();

  if (!CODE_PATTERN.test(normalized)) {
    return res.status(400).json({ error: 'Invalid code format — expected X-XXXX' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data, error } = await supabase
    .from('packs')
    .select('pack_data')
    .eq('short_code', normalized)
    .maybeSingle();   // returns null instead of error when row not found

  if (error) {
    console.error('[api/load] Supabase query error:', error);
    return res.status(500).json({ error: 'Database error — could not load pack' });
  }

  if (!data) {
    return res.status(404).json({ error: `No pack found for code "${normalized}"` });
  }

  return res.status(200).json(data.pack_data);
};
