import express, { type Express } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from './config.js';
import './db.js';
import { jobsRouter } from './routes/jobs.js';
import { resumeRouter } from './routes/resume.js';
import { settingsRouter } from './routes/settings.js';
import { refreshJobs } from './services/refresh.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconSvgPath = resolve(__dirname, '../../resources/icon.svg');

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  
  // Request logging
  app.use((req, _res, next) => {
    console.log(`[api] ${req.method} ${req.url}`);
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/favicon', (_req, res) => {
    res.sendFile(iconSvgPath, { headers: { 'Content-Type': 'image/svg+xml' } });
  });

  app.use('/api/jobs', jobsRouter);
  app.use('/api/resume', resumeRouter);
  app.use('/api/settings', settingsRouter);

  // 404 handler
  app.use((req, res) => {
    console.warn(`[api] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
  });

  return app;
}

export function startCron(): void {
  if (cron.validate(config.refreshCron)) {
    cron.schedule(config.refreshCron, () => {
      console.log('[cron] running scheduled refresh');
      refreshJobs()
        .then((r) => console.log('[cron] done:', r))
        .catch((err) => console.error('[cron] failed:', err));
    });
    console.log(`[cron] scheduled with "${config.refreshCron}"`);
  } else {
    console.warn(`[cron] invalid expression "${config.refreshCron}"; skipping schedule`);
  }
}
