import { db, getSetting } from '../db.js';
import { config } from '../config.js';
import { adzuna } from './fetchers/adzuna.js';
import { themuse } from './fetchers/themuse.js';
import { remoteok } from './fetchers/remoteok.js';
import { workable } from './fetchers/workable.js';
import { findwork } from './fetchers/findwork.js';
import type { FetchedJob, FetchParams } from './fetchers/types.js';
import { scoreJobs } from './matcher.js';

export interface SourceResult {
  source: string;
  count: number;
  error?: string;
}

function currentParams(): FetchParams {
  return {
    title: getSetting('search_title') ?? config.defaults.title,
    location: getSetting('search_location') ?? config.defaults.location,
    includeRemote:
      (getSetting('include_remote') ?? String(config.defaults.includeRemote)) === 'true',
  };
}

export async function refreshJobs(
  onSourceDone?: (result: SourceResult) => void,
): Promise<{ fetched: number; added: number }> {
  const params = currentParams();
  const ranAt = new Date().toISOString();

  // Run all fetchers concurrently; report each one as it settles
  const fetchers: Array<{ source: string; fn: () => Promise<FetchedJob[]> }> = [
    { source: 'adzuna',   fn: () => adzuna(params)   },
    { source: 'themuse',  fn: () => themuse(params)   },
    { source: 'remoteok', fn: () => remoteok(params)  },
    { source: 'workable', fn: () => workable(params)  },
    { source: 'findwork', fn: () => findwork(params)  },
  ];

  const buckets: FetchedJob[][] = await Promise.all(
    fetchers.map(({ source, fn }) =>
      fn()
        .then((jobs) => {
          onSourceDone?.({ source, count: jobs.length });
          return jobs;
        })
        .catch((err) => {
          const error = err instanceof Error ? err.message : String(err);
          console.error(`[refresh] ${source} failed:`, error);
          onSourceDone?.({ source, count: 0, error });
          return [] as FetchedJob[];
        }),
    ),
  );

  const fetched = buckets.flat().filter((j) => j.title);

  const resume = db.prepare('SELECT text FROM resume WHERE id = 1').get() as
    | { text: string }
    | undefined;

  let scores = new Map<string, { score: number; matchedTerms: string[] }>();
  if (resume?.text) {
    const forScoring = fetched.map((j) => ({
      id: `${j.source}:${j.sourceId}`,
      title: j.title,
      description: j.description,
    }));
    scores = await scoreJobs(resume.text, forScoring);
  }

  const insertStmt = db.prepare(`
    INSERT INTO jobs (id, source, source_id, title, company, location, remote, url, description, posted_at, salary, score, matched_terms, fetched_at)
    VALUES (@id, @source, @source_id, @title, @company, @location, @remote, @url, @description, @posted_at, @salary, @score, @matched_terms, @fetched_at)
    ON CONFLICT(source, source_id) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      remote = excluded.remote,
      url = excluded.url,
      description = excluded.description,
      posted_at = excluded.posted_at,
      salary = excluded.salary,
      score = excluded.score,
      matched_terms = excluded.matched_terms,
      fetched_at = excluded.fetched_at
  `);

  const countBefore = (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;

  const insertMany = db.transaction((items: FetchedJob[]) => {
    for (const j of items) {
      const id = `${j.source}:${j.sourceId}`;
      const match = scores.get(id);
      insertStmt.run({
        id,
        source: j.source,
        source_id: j.sourceId,
        title: j.title,
        company: j.company,
        location: j.location,
        remote: j.remote ? 1 : 0,
        url: j.url,
        description: j.description,
        posted_at: j.postedAt,
        salary: j.salary,
        score: match?.score ?? 0,
        matched_terms: match ? JSON.stringify(match.matchedTerms) : null,
        fetched_at: ranAt,
      });
    }
  });

  insertMany(fetched);

  const countAfter = (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;
  const added = countAfter - countBefore;

  db.prepare(
    'INSERT INTO refresh_log (ran_at, fetched_count, new_count, error) VALUES (?, ?, ?, ?)',
  ).run(ranAt, fetched.length, added, null);

  return { fetched: fetched.length, added };
}

/**
 * Rescore all existing jobs against the current resume (no re-fetch).
 */
export async function rescoreAll(): Promise<number> {
  const resume = db.prepare('SELECT text FROM resume WHERE id = 1').get() as
    | { text: string }
    | undefined;
  if (!resume?.text) return 0;

  const jobs = db
    .prepare('SELECT id, title, description FROM jobs')
    .all() as Array<{ id: string; title: string; description: string | null }>;

  const scores = await scoreJobs(resume.text, jobs);
  const stmt = db.prepare('UPDATE jobs SET score = ?, matched_terms = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const j of jobs) {
      const m = scores.get(j.id);
      if (m) stmt.run(m.score, JSON.stringify(m.matchedTerms), j.id);
    }
  });
  tx();
  return jobs.length;
}
