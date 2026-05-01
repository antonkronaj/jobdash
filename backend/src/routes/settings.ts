import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { config } from '../config.js';
import { rescoreAll } from '../services/refresh.js';
import { reloadUserStopwords } from '../services/resumeParser.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json({
    title: getSetting('search_title') ?? config.defaults.title,
    location: getSetting('search_location') ?? config.defaults.location,
    includeRemote:
      (getSetting('include_remote') ?? String(config.defaults.includeRemote)) === 'true',
  });
});

settingsRouter.put('/', (req, res) => {
  const { title, location, includeRemote } = req.body as {
    title?: string;
    location?: string;
    includeRemote?: boolean;
  };
  if (title !== undefined) setSetting('search_title', title);
  if (location !== undefined) setSetting('search_location', location);
  if (includeRemote !== undefined) setSetting('include_remote', String(includeRemote));
  res.json({ ok: true });
});

// API keys: GET returns booleans for secrets (never the values) plus the
// non-secret country code; PUT accepts new values, with empty string clearing.
settingsRouter.get('/keys', (_req, res) => {
  res.json({
    adzunaAppId: !!(getSetting('adzuna_app_id') || process.env.ADZUNA_APP_ID),
    adzunaAppKey: !!(getSetting('adzuna_app_key') || process.env.ADZUNA_APP_KEY),
    adzunaCountry: getSetting('adzuna_country') || process.env.ADZUNA_COUNTRY || 'us',
    findworkApiKey: !!(getSetting('findwork_api_key') || process.env.FINDWORK_API_KEY),
  });
});

settingsRouter.put('/keys', (req, res) => {
  const { adzunaAppId, adzunaAppKey, adzunaCountry, findworkApiKey } = req.body as {
    adzunaAppId?: string;
    adzunaAppKey?: string;
    adzunaCountry?: string;
    findworkApiKey?: string;
  };
  if (adzunaAppId !== undefined) setSetting('adzuna_app_id', adzunaAppId.trim());
  if (adzunaAppKey !== undefined) setSetting('adzuna_app_key', adzunaAppKey.trim());
  if (adzunaCountry !== undefined) setSetting('adzuna_country', adzunaCountry.trim().toLowerCase());
  if (findworkApiKey !== undefined) setSetting('findwork_api_key', findworkApiKey.trim());
  res.json({ ok: true });
});

// Term boosts: a map of {term: weight} that multiplies each term's TF-IDF
// weight at scoring time. Higher weight = more influence on the score.
settingsRouter.get('/term-boosts', (_req, res) => {
  const raw = getSetting('term_boosts');
  let boosts: Record<string, number> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) boosts = parsed;
    } catch { /* ignore malformed */ }
  }
  res.json({ boosts });
});

settingsRouter.put('/term-boosts', async (req, res) => {
  const { boosts } = req.body as { boosts?: Record<string, number> };
  if (!boosts || typeof boosts !== 'object') {
    res.status(400).json({ error: 'boosts must be an object' });
    return;
  }

  // Sanitize: keys lowercased, values must be positive finite numbers.
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(boosts)) {
    const term = String(k).trim().toLowerCase();
    const weight = Number(v);
    if (term && Number.isFinite(weight) && weight > 0) clean[term] = weight;
  }

  setSetting('term_boosts', JSON.stringify(clean));
  try {
    const rescored = await rescoreAll();
    res.json({ ok: true, rescored });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// User stopwords: extra words to ignore during tokenization (in addition to the
// built-in lists). Saving triggers a rescore since it changes term extraction.
settingsRouter.get('/stopwords', (_req, res) => {
  const raw = getSetting('user_stopwords');
  let words: string[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) words = parsed.map((w) => String(w));
    } catch { /* ignore malformed */ }
  }
  res.json({ words });
});

settingsRouter.put('/stopwords', async (req, res) => {
  const { words } = req.body as { words?: string[] };
  if (!Array.isArray(words)) {
    res.status(400).json({ error: 'words must be an array' });
    return;
  }

  // Normalize: lowercase, trim, dedupe, drop empties.
  const clean = [...new Set(
    words
      .map((w) => String(w).trim().toLowerCase())
      .filter((w) => w.length > 0),
  )];

  setSetting('user_stopwords', JSON.stringify(clean));
  reloadUserStopwords();

  try {
    const rescored = await rescoreAll();
    res.json({ ok: true, rescored, count: clean.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
