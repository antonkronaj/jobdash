import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { config } from '../config.js';

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
