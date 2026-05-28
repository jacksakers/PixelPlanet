/**
 * api/save.js — Vercel Serverless Function
 *
 * POST /api/save
 * Body: JSON object (full entity pack: { entities, globalRules, entityRules })
 *
 * Generates a unique 5-char alphanumeric short code (formatted X-XXXX),
 * inserts a row into the Supabase `packs` table, and returns the code.
 *
 * Env vars required (set in Vercel project settings):
 *   SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Omit visually ambiguous chars (O/0, I/1) to keep codes easy to read/type.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN   = 5;
const MAX_TRIES  = 8;

function generateCode() {
  let raw = '';
  for (let i = 0; i < CODE_LEN; i++) {
    raw += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  // Format as X-XXXX  (e.g. P-X7K9)
  return `${raw[0]}-${raw.slice(1)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Guard: catch missing env vars early with a clear message.
  if (!process.env.SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[api/save] Missing env vars: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return res.status(500).json({ error: 'Server misconfiguration: Supabase env vars not set' });
  }

  let pack_data;
  let title = 'Untitled Pack';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Body must be a JSON object');
    }
    // Accept { title, pack } wrapper OR raw pack at top level
    if (body.pack && typeof body.pack === 'object') {
      pack_data = body.pack;
      title     = typeof body.title === 'string' && body.title.trim()
                  ? body.title.trim().slice(0, 80)
                  : 'Untitled Pack';
    } else {
      pack_data = body;
      title     = 'Untitled Pack';
    }
  } catch (err) {
    return res.status(400).json({ error: `Invalid request body: ${err.message}` });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const short_code = generateCode();

    const { error } = await supabase
      .from('packs')
      .insert({ short_code, pack_data, title });

    if (!error) {
      // Success — return the code to the client.
      return res.status(200).json({ code: short_code });
    }

    // PostgreSQL unique-violation code (from Supabase error details).
    const isCollision =
      error.code === '23505' ||
      (error.message ?? '').includes('duplicate key');

    if (isCollision) {
      // Code already taken — retry with a new one.
      continue;
    }

    // Any other DB error is not retriable.
    console.error('[api/save] Supabase insert error:', error);
    return res.status(500).json({ error: 'Database error — could not save pack' });
  }

  return res
    .status(500)
    .json({ error: 'Could not generate a unique code — please try again' });
};
