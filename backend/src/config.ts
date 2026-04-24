import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databasePath: process.env.DATABASE_PATH ?? './data/jobdash.db',
  adzuna: {
    appId: process.env.ADZUNA_APP_ID ?? '',
    appKey: process.env.ADZUNA_APP_KEY ?? '',
    country: process.env.ADZUNA_COUNTRY ?? 'us',
  },
  defaults: {
    title: process.env.DEFAULT_SEARCH_TITLE ?? 'Software Engineer',
    location: process.env.DEFAULT_SEARCH_LOCATION ?? 'Portland, Oregon',
    includeRemote: (process.env.DEFAULT_INCLUDE_REMOTE ?? 'true') === 'true',
  },
  refreshCron: process.env.REFRESH_CRON ?? '0 6 * * *',
};
