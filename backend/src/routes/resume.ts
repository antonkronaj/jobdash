import { Router } from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { parseResumePdf, extractTerms } from '../services/resumeParser.js';
import { rescoreAll } from '../services/refresh.js';

export const resumeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

resumeRouter.get('/', (_req, res) => {
  const row = db
    .prepare('SELECT filename, uploaded_at, length(text) as chars FROM resume WHERE id = 1')
    .get() as { filename: string; uploaded_at: string; chars: number } | undefined;
  if (!row) {
    res.json({ uploaded: false });
    return;
  }
  res.json({ uploaded: true, filename: row.filename, uploadedAt: row.uploaded_at, chars: row.chars });
});

resumeRouter.post('/', upload.single('resume'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded (field name: resume)' });
    return;
  }
  try {
    const text = await parseResumePdf(req.file.buffer);
    const terms = extractTerms(text);
    const uploadedAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO resume (id, filename, text, terms, uploaded_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         filename = excluded.filename,
         text = excluded.text,
         terms = excluded.terms,
         uploaded_at = excluded.uploaded_at`,
    ).run(req.file.originalname, text, JSON.stringify(terms), uploadedAt);

    const rescored = rescoreAll();
    res.json({ ok: true, chars: text.length, termCount: terms.length, rescored });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
