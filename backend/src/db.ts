import Database from 'better-sqlite3';
import { config } from './config.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    remote INTEGER DEFAULT 0,
    url TEXT NOT NULL,
    description TEXT,
    posted_at TEXT,
    salary TEXT,
    score REAL DEFAULT 0,
    matched_terms TEXT,
    hidden INTEGER DEFAULT 0,
    saved INTEGER DEFAULT 0,
    fetched_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(score DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_hidden ON jobs(hidden);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_unique ON jobs(source, source_id);

  CREATE TABLE IF NOT EXISTS resume (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    filename TEXT,
    text TEXT,
    terms TEXT,
    uploaded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS refresh_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ran_at TEXT NOT NULL,
    fetched_count INTEGER,
    new_count INTEGER,
    error TEXT
  );
`);

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}
