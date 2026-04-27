# jobdash

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Personal job-recommendation desktop app. Pulls Software Engineer postings from five sources (Adzuna, The Muse, RemoteOK, Findwork, Workable), parses your resume PDF, and ranks jobs by TF-IDF cosine similarity against the resume — no paid AI key required.

You can visit https://publicapis.io/category/jobs to see what job APIS that are available.
## Stack

- **Desktop shell**: Electron 35 (ESM main process, ships Node 22)
- **Backend**: Node.js + Express + TypeScript, `better-sqlite3` for local storage, `pdf-parse` for resume parsing, `natural` for TF-IDF scoring, `node-cron` for scheduled refresh. In the desktop app this runs in-process inside Electron's main process, bound to a random port on `127.0.0.1`.
- **Frontend**: Angular 18 (standalone components, signals).

## Structure

```
jobdash/
├── electron/     # Electron main process (loads backend in-process, opens BrowserWindow)
├── backend/      # API server, scheduler, matching engine
├── frontend/     # Angular dashboard
└── package.json  # Top-level: electron + electron-builder + orchestration scripts
```

## Setup

Node is installed via mise (`mise use -g node@22`).

```bash
# from repo root — installs root deps, then both subprojects
npm install
npm --prefix backend install
npm --prefix frontend install
```

The first `npm install` runs `electron-builder install-app-deps`, which rebuilds `better-sqlite3` against Electron's Node ABI. The `backend/` postinstall does the same automatically whenever you reinstall backend deps, so you generally don't need to think about native rebuilds.

If you ever see `NODE_MODULE_VERSION` errors at launch, run:

```bash
npx electron-rebuild -f -w better-sqlite3 -m backend
```

## Run the desktop app

```bash
npm run build      # builds backend, frontend (with relative base href), and electron main
npm start          # launches Electron, loads built bundle
```

## Dev mode (Angular hot reload + DevTools)

```bash
# terminal 1 — Angular dev server on :4200
npm run dev:frontend

# terminal 2 — Electron pointed at the dev server
npm run dev:electron
```

`dev:electron` sets `JOBDASH_DEV=1`, builds the backend + main process, then opens DevTools on launch.

## Build distributable installers

```bash
npm run dist       # runs `npm run build` then electron-builder
```

Outputs to `dist/` (or `release/`) — `.dmg` on macOS, `.exe` (NSIS) on Windows, `AppImage` on Linux. Configure `appId`, icon, and signing in the `build` block of root `package.json`.

## Standalone backend (no Electron)

The Express server still works on its own:

```bash
cd backend
npm run dev        # http://localhost:3001
```

In standalone mode the frontend can be served by `ng serve` separately:

```bash
cd frontend
npm start          # http://localhost:4200
```

## API keys

Two ways to provide keys, in order of precedence:

1. **In-app Settings** (recommended for the desktop app) — click **▸ API keys** in the dashboard, paste your keys, Save. They're stored in the local SQLite DB at `~/Library/Application Support/jobdash/jobdash.db` (macOS) and never displayed again — only a "set / missing" status badge.
2. **Environment variables** (fallback, also used by the standalone backend in dev) — see `backend/.env.example`.

**Adzuna** — register at https://developer.adzuna.com/signup. Free account; copy `app_id` and `app_key` from your dashboard. Env vars: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY` (default `us`).

**Findwork** — register at https://findwork.dev/register. After email confirmation, find your token at https://findwork.dev/dashboard/api-token. Env var: `FINDWORK_API_KEY`.

**The Muse, RemoteOK, Workable** — no key required; fetched anonymously.

### Other env vars

- `DEFAULT_SEARCH_TITLE` (default `Software Engineer`)
- `DEFAULT_SEARCH_LOCATION` (default `Portland, Oregon`)
- `DEFAULT_INCLUDE_REMOTE` (default `true`)
- `REFRESH_CRON` (default `0 6 * * *` — 6am daily)
- `DATABASE_PATH` — overridden by Electron at startup to point at the per-user data dir; defaults to `./data/jobdash.db` for the standalone backend.

## Usage

1. Launch the app (`npm start`).
2. Open the **API keys** panel and add your Adzuna + Findwork credentials (or set env vars before launch).
3. Upload your resume PDF (top panel).
4. Click **Refresh now** — fetches from all five sources and scores every job against your resume.
5. Scores are 0–100%. Sort is by score DESC. Use the min-score slider to filter noise.
6. Filters: source chips (click to toggle), US-only, Posted within 24h / 7d / 30d, Saved-only, Show hidden.
7. Click a job to expand the description. Save (★) or hide (✕) jobs. Hidden jobs are excluded unless "Show hidden" is toggled.
8. While the app is open, the cron triggers a refresh at 6am local. (Closed apps don't fetch — there's no background daemon.)

## How matching works

- PDF text → tokenized, stopwords removed.
- TF-IDF over `[resume, job1, job2, ...]` corpus → cosine similarity between resume and each job.
- Small bonus for overlap with top-60 resume terms.
- Rescoring runs automatically on resume upload.

## API (consumed by the renderer over `127.0.0.1:<random port>`)

- `GET /api/jobs?showHidden=&savedOnly=&minScore=`
- `POST /api/jobs/refresh`
- `PATCH /api/jobs/:id` body `{ hidden?, saved? }`
- `GET /api/jobs/stats`
- `GET /api/jobs/sources`
- `GET /api/resume` · `POST /api/resume` (multipart `resume`, PDF)
- `GET /api/settings` · `PUT /api/settings` body `{ title?, location?, includeRemote? }`
- `GET /api/settings/keys` (returns booleans for secrets, never the values)
- `PUT /api/settings/keys` body `{ adzunaAppId?, adzunaAppKey?, adzunaCountry?, findworkApiKey? }` (empty string clears)

The renderer reads its API base from `?apiPort=<n>` injected into `index.html` at launch.

## Notes

- **Database location**: `~/Library/Application Support/jobdash/jobdash.db` (macOS) when running under Electron; `backend/data/jobdash.db` for the standalone backend. WAL mode.
- **Resume uploads** are processed in memory; only the parsed text + filename are persisted to SQLite.
- `.env` is gitignored. Rotate Adzuna keys if they leak.
- LinkedIn is intentionally excluded — no public API, and scraping violates their ToS.
- After installing/updating backend deps standalone (`cd backend && npm install`), the postinstall auto-rebuilds `better-sqlite3` against Electron's ABI when run inside this monorepo.
