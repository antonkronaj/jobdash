# jobdash

Personal job-recommendation dashboard. Pulls Software Engineer postings from five sources (Adzuna, The Muse, RemoteOK, Findwork, Workable), parses your resume PDF, and ranks jobs by TF-IDF cosine similarity against the resume — no paid AI key required.

## Stack

- **Backend**: Node.js + Express + TypeScript, `better-sqlite3` for local storage, `pdf-parse` for resume parsing, `natural` for TF-IDF scoring, `node-cron` for daily refresh.
- **Frontend**: Angular 18 (standalone components, signals).

## Structure

```
jobdash/
├── backend/   # API server, scheduler, matching engine
└── frontend/  # Angular dashboard
```

## Setup

Node is installed via mise (`mise use -g node@22`).

### Backend

```bash
cd backend
npm install
# .env already contains your Adzuna credentials
npm run dev          # http://localhost:3001
```

Environment variables (see `.env.example`):
- `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY` (default `us`)
- `FINDWORK_API_KEY`
- `DEFAULT_SEARCH_TITLE` (default `Software Engineer`)
- `DEFAULT_SEARCH_LOCATION` (default `Portland, Oregon`)
- `DEFAULT_INCLUDE_REMOTE` (default `true`)
- `REFRESH_CRON` (default `0 6 * * *` — 6am daily)

### API keys

**Adzuna** — register at https://developer.adzuna.com/signup. Creates a free account; copy the `app_id` and `app_key` from your dashboard into `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.

**Findwork** — register at https://findwork.dev/register. After email confirmation, find your token at https://findwork.dev/dashboard/api-token and set it as `FINDWORK_API_KEY`.

**The Muse, RemoteOK, Workable** — no key required; fetched anonymously.

### Frontend

```bash
cd frontend
npm install
npm start            # http://localhost:4200
```

## Usage

1. Start backend + frontend.
2. Open http://localhost:4200.
3. Upload your resume PDF (top panel).
4. Click **Refresh now** — fetches from all five sources and scores every job against your resume.
5. Scores are 0–100%. Sort is by score DESC. Use min-score slider to filter noise.
6. Click a job to expand the description. Save (★) or hide (✕) jobs. Hidden jobs are excluded unless "Show hidden" is toggled.
7. Daily cron runs at 6am local; new jobs appear on next page load.

## How matching works

- PDF text → tokenized, stopwords removed.
- TF-IDF over `[resume, job1, job2, ...]` corpus → cosine similarity between resume and each job.
- Small bonus for overlap with top-60 resume terms.
- Rescoring runs automatically on resume upload.

## API

- `GET /api/jobs?showHidden=&savedOnly=&minScore=`
- `POST /api/jobs/refresh`
- `PATCH /api/jobs/:id` body `{ hidden?, saved? }`
- `GET /api/jobs/stats`
- `GET /api/resume` · `POST /api/resume` (multipart `resume`, PDF)
- `GET /api/settings` · `PUT /api/settings` body `{ title?, location?, includeRemote? }`

## Notes

- SQLite database at `backend/data/jobdash.db`, WAL mode.
- `.env` is gitignored. Rotate Adzuna keys if they leak.
- LinkedIn is intentionally excluded — no public API, and scraping violates their ToS.
