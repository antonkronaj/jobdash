import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { config } from '../config.js';
export const settingsRouter = Router();
settingsRouter.get('/', (_req, res) => {
    res.json({
        title: getSetting('search_title') ?? config.defaults.title,
        location: getSetting('search_location') ?? config.defaults.location,
        includeRemote: (getSetting('include_remote') ?? String(config.defaults.includeRemote)) === 'true',
    });
});
settingsRouter.put('/', (req, res) => {
    const { title, location, includeRemote } = req.body;
    if (title !== undefined)
        setSetting('search_title', title);
    if (location !== undefined)
        setSetting('search_location', location);
    if (includeRemote !== undefined)
        setSetting('include_remote', String(includeRemote));
    res.json({ ok: true });
});
//# sourceMappingURL=settings.js.map