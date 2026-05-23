/**
 * api/save.js — Vercel Serverless Function
 *
 * POST /api/save
 * Body: { entities, globalRules, entityRules }   (PixelPlanet pack JSON)
 *
 * Generates a short code (format: X-XXXX, e.g. P-X7K9), stores the pack in
 * Supabase, and returns the code to the caller.
 *
 * Env vars required:
 *   SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Uppercase letters + digits, excluding visually ambiguous chars (0, O, I, 1)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  // Format: X-XXXX  (5 meaningful chars displayed as 6 with separator)
  const pick = () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Parse body — Vercel auto-parses JSON when Content-Type is application/json
  const packData = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body); } catch { return null; } })()
    : req.body;

  if (!packData || typeof packData !== 'object' || Array.isArray(packData)) {
    return res.status(400).json({ error: 'Request body must be a JSON object (pack data).' });
  }

  // Basic structure check — must have at least one of the known pack keys
  const validKeys = ['entities', 'globalRules', 'entityRules'];
  const hasValidKey = validKeys.some((k) => k in packData);
  if (!hasValidKey) {
    return res.status(400).json({ error: 'Pack data must contain entities, globalRules, or entityRules.' });
  }

  // Retry loop to handle the rare short-code collision
  const MAX_ATTEMPTS = 8;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const shortCode = generateCode();

    const { error } = await supabase
      .from('packs')
      .insert({ short_code: shortCode, pack_data: packData });

    if (!error) {
      return res.status(200).json({ code: shortCode });
    }

    // Postgres unique-constraint violation → try a new code
    if (error.code === '23505') continue;

    // Any other database error
    console.error('[api/save] Supabase insert error:', error);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }

  return res.status(500).json({ error: 'Could not generate a unique code. Please try again.' });
}
