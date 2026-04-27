import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config.js';
import './db.js';
import { jobsRouter } from './routes/jobs.js';
import { resumeRouter } from './routes/resume.js';
import { settingsRouter } from './routes/settings.js';
import { refreshJobs } from './services/refresh.js';
export function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '2mb' }));
    app.get('/api/health', (_req, res) => {
        res.json({ ok: true });
    });
    app.use('/api/jobs', jobsRouter);
    app.use('/api/resume', resumeRouter);
    app.use('/api/settings', settingsRouter);
    return app;
}
export function startCron() {
    if (cron.validate(config.refreshCron)) {
        cron.schedule(config.refreshCron, () => {
            console.log('[cron] running scheduled refresh');
            refreshJobs()
                .then((r) => console.log('[cron] done:', r))
                .catch((err) => console.error('[cron] failed:', err));
        });
        console.log(`[cron] scheduled with "${config.refreshCron}"`);
    }
    else {
        console.warn(`[cron] invalid expression "${config.refreshCron}"; skipping schedule`);
    }
}
//# sourceMappingURL=app.js.map