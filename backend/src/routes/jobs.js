import { Router } from 'express';
import { db } from '../db.js';
import { refreshJobs } from '../services/refresh.js';
export const jobsRouter = Router();
function rowToJob(r) {
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
        matchedTerms: r.matched_terms ? JSON.parse(r.matched_terms) : [],
        hidden: !!r.hidden,
        saved: !!r.saved,
        fetchedAt: r.fetched_at,
    };
}
jobsRouter.get('/', (req, res) => {
    const showHidden = req.query.showHidden === 'true';
    const savedOnly = req.query.savedOnly === 'true';
    const minScore = Number(req.query.minScore ?? 0);
    let sql = 'SELECT * FROM jobs WHERE score >= ?';
    const params = [minScore];
    if (!showHidden)
        sql += ' AND hidden = 0';
    if (savedOnly)
        sql += ' AND saved = 1';
    sql += ' ORDER BY score DESC, fetched_at DESC LIMIT 500';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(rowToJob));
});
jobsRouter.post('/refresh', async (_req, res) => {
    try {
        const result = await refreshJobs();
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
jobsRouter.patch('/:id', (req, res) => {
    const { id } = req.params;
    const { hidden, saved } = req.body;
    const fields = [];
    const values = [];
    if (hidden !== undefined) {
        fields.push('hidden = ?');
        values.push(hidden ? 1 : 0);
    }
    if (saved !== undefined) {
        fields.push('saved = ?');
        values.push(saved ? 1 : 0);
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
        .all();
    res.json(rows);
});
jobsRouter.get('/stats', (_req, res) => {
    const total = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
    const visible = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE hidden = 0').get().c;
    const saved = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE saved = 1').get().c;
    const lastRun = db
        .prepare('SELECT ran_at, fetched_count, new_count, error FROM refresh_log ORDER BY id DESC LIMIT 1')
        .get();
    res.json({ total, visible, saved, lastRun: lastRun ?? null });
});
//# sourceMappingURL=jobs.js.map