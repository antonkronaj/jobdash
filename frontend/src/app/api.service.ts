import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type RefreshEvent =
  | { type: 'source'; source: string; count: number; error?: string }
  | { type: 'done'; fetched: number; added: number }
  | { type: 'error'; error: string };

export interface Job {
  id: string;
  source: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  url: string;
  description: string | null;
  postedAt: string | null;
  salary: string | null;
  score: number;
  matchedTerms: string[];
  hidden: boolean;
  saved: boolean;
  applied: boolean;
  appliedAt: string | null;
  notes: string | null;
  fetchedAt: string;
}

export interface Settings {
  title: string;
  location: string;
  includeRemote: boolean;
}

export interface ResumeInfo {
  uploaded: boolean;
  filename?: string;
  uploadedAt?: string;
  chars?: number;
}

export interface ApiKeysStatus {
  adzunaAppId: boolean;
  adzunaAppKey: boolean;
  adzunaCountry: string;
  findworkApiKey: boolean;
}

export interface ApiKeysUpdate {
  adzunaAppId?: string;
  adzunaAppKey?: string;
  adzunaCountry?: string;
  findworkApiKey?: string;
}

export interface Stats {
  total: number;
  visible: number;
  hidden: number;
  saved: number;
  applied: number;
  lastRun: {
    ran_at: string;
    fetched_count: number;
    new_count: number;
    error: string | null;
  } | null;
}

function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const port = new URLSearchParams(window.location.search).get('apiPort');
    if (port) return `http://127.0.0.1:${port}/api`;
  }
  return 'http://localhost:3001/api';
}

const API = resolveApiBase();

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  listJobs(opts: { showHidden?: boolean; savedOnly?: boolean; appliedOnly?: boolean; minScore?: number } = {}): Observable<Job[]> {
    const params: Record<string, string> = {};
    if (opts.showHidden) params['showHidden'] = 'true';
    if (opts.savedOnly) params['savedOnly'] = 'true';
    if (opts.appliedOnly) params['appliedOnly'] = 'true';
    if (opts.minScore !== undefined) params['minScore'] = String(opts.minScore);
    return this.http.get<Job[]>(`${API}/jobs`, { params });
  }

  refresh(): Observable<RefreshEvent> {
    return new Observable<RefreshEvent>((observer) => {
      const controller = new AbortController();
      const decoder = new TextDecoder();

      fetch(`${API}/jobs/refresh`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' },
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            observer.error(new Error(`HTTP ${response.status}`));
            return;
          }
          const reader = response.body.getReader();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop()!;
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const event: RefreshEvent = JSON.parse(line.slice(6));
                observer.next(event);
                if (event.type === 'done' || event.type === 'error') {
                  observer.complete();
                  return;
                }
              } catch { /* skip malformed lines */ }
            }
          }
          observer.complete();
        })
        .catch((err) => {
          if (err.name !== 'AbortError') observer.error(err);
        });

      return () => controller.abort();
    });
  }

  updateJob(id: string, patch: { hidden?: boolean; saved?: boolean; applied?: boolean; appliedAt?: string | null; notes?: string | null }): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${API}/jobs/${encodeURIComponent(id)}`, patch);
  }

  stats(): Observable<Stats> {
    return this.http.get<Stats>(`${API}/jobs/stats`);
  }

  getSources(): Observable<{ source: string; count: number }[]> {
    return this.http.get<{ source: string; count: number }[]>(`${API}/jobs/sources`);
  }

  getSettings(): Observable<Settings> {
    return this.http.get<Settings>(`${API}/settings`);
  }

  saveSettings(s: Settings): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${API}/settings`, s);
  }

  getKeys(): Observable<ApiKeysStatus> {
    return this.http.get<ApiKeysStatus>(`${API}/settings/keys`);
  }

  saveKeys(patch: ApiKeysUpdate): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${API}/settings/keys`, patch);
  }

  getResume(): Observable<ResumeInfo> {
    return this.http.get<ResumeInfo>(`${API}/resume`);
  }

  uploadResume(file: File): Observable<{ ok: boolean; chars: number; termCount: number; rescored: number }> {
    const fd = new FormData();
    fd.append('resume', file);
    return this.http.post<{ ok: boolean; chars: number; termCount: number; rescored: number }>(
      `${API}/resume`,
      fd,
    );
  }
}
