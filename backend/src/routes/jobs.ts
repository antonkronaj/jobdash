import { Router } from 'express';
import { db } from '../db.js';
import { refreshJobs } from '../services/refresh.js';

export const jobsRouter = Router();

interface JobRow {
  id: string;
  source: string;
  source_id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: number;
  url: string;
  description: string | null;
  posted_at: string | null;
  salary: string | null;
  score: number;
  matched_terms: string | null;
  hidden: number;
  saved: number;
  applied: number;
  applied_at: string | null;
  notes: string | null;
  fetched_at: string;
}

function rowToJob(r: JobRow) {
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    company: r.company,
    location: r.location,
    remote: !!r.remote,
    url: r.url,
    description: r.description,
    postedAt: r.posted_at,
    salary: r.salary,
    score: r.score,
    matchedTerms: r.matched_terms ? (JSON.parse(r.matched_terms) as string[]) : [],
    hidden: !!r.hidden,
    saved: !!r.saved,
    applied: !!r.applied,
    appliedAt: r.applied_at,
    notes: r.notes,
    fetchedAt: r.fetched_at,
  };
}

jobsRouter.get('/', (req, res) => {
  const showHidden = req.query.showHidden === 'true';
  const savedOnly = req.query.savedOnly === 'true';
  const appliedOnly = req.query.appliedOnly === 'true';
  const minScore = Number(req.query.minScore ?? 0);

  let sql = 'SELECT * FROM jobs WHERE score >= ?';
  const params: unknown[] = [minScore];
  if (!showHidden) sql += ' AND hidden = 0';
  if (savedOnly) sql += ' AND saved = 1';
  if (appliedOnly) sql += ' AND applied = 1';
  sql += ' ORDER BY score DESC, fetched_at DESC LIMIT 500';

  const rows = db.prepare(sql).all(...params) as JobRow[];
  res.json(rows.map(rowToJob));
});

jobsRouter.post('/refresh', async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const result = await refreshJobs((sourceResult) => {
      send({ type: 'source', ...sourceResult });
    });
    send({ type: 'done', ...result });
  } catch (err) {
    send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }

  res.end();
});

jobsRouter.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { hidden, saved, applied, appliedAt, notes } = req.body as {
    hidden?: boolean;
    saved?: boolean;
    applied?: boolean;
    appliedAt?: string | null;
    notes?: string | null;
  };
  const fields: string[] = [];
  const values: unknown[] = [];
  if (hidden !== undefined) {
    fields.push('hidden = ?');
    values.push(hidden ? 1 : 0);
  }
  if (saved !== undefined) {
    fields.push('saved = ?');
    values.push(saved ? 1 : 0);
  }
  if (applied !== undefined) {
    fields.push('applied = ?');
    values.push(applied ? 1 : 0);
  }
  if (appliedAt !== undefined) {
    fields.push('applied_at = ?');
    values.push(appliedAt ?? null);
  }
  if (notes !== undefined) {
    fields.push('notes = ?');
    values.push(notes ?? null);
  }
  if (!fields.length) {
    res.status(400).json({ error: 'no fields to update' });
    return;
  }
  values.push(id);
  db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

jobsRouter.get('/sources', (_req, res) => {
  const rows = db
    .prepare('SELECT source, COUNT(*) as count FROM jobs GROUP BY source ORDER BY count DESC')
    .all() as { source: string; count: number }[];
  res.json(rows);
});

jobsRouter.get('/stats', (_req, res) => {
  const total = (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;
  const visible = (
    db.prepare('SELECT COUNT(*) as c FROM jobs WHERE hidden = 0').get() as { c: number }
  ).c;
  const hidden = (
    db.prepare('SELECT COUNT(*) as c FROM jobs WHERE hidden = 1').get() as { c: number }
  ).c;
  const saved = (
    db.prepare('SELECT COUNT(*) as c FROM jobs WHERE saved = 1 AND hidden = 0').get() as { c: number }
  ).c;
  const applied = (
    db.prepare('SELECT COUNT(*) as c FROM jobs WHERE applied = 1 AND hidden = 0').get() as { c: number }
  ).c;
  const lastRun = db
    .prepare('SELECT ran_at, fetched_count, new_count, error FROM refresh_log ORDER BY id DESC LIMIT 1')
    .get() as
    | { ran_at: string; fetched_count: number; new_count: number; error: string | null }
    | undefined;
  res.json({ total, visible, hidden, saved, applied, lastRun: lastRun ?? null });
});
