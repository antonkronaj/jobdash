import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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

export interface Stats {
  total: number;
  visible: number;
  saved: number;
  lastRun: {
    ran_at: string;
    fetched_count: number;
    new_count: number;
    error: string | null;
  } | null;
}

const API = 'http://localhost:3001/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  listJobs(opts: { showHidden?: boolean; savedOnly?: boolean; minScore?: number } = {}): Observable<Job[]> {
    const params: Record<string, string> = {};
    if (opts.showHidden) params['showHidden'] = 'true';
    if (opts.savedOnly) params['savedOnly'] = 'true';
    if (opts.minScore !== undefined) params['minScore'] = String(opts.minScore);
    return this.http.get<Job[]>(`${API}/jobs`, { params });
  }

  refresh(): Observable<{ fetched: number; added: number }> {
    return this.http.post<{ fetched: number; added: number }>(`${API}/jobs/refresh`, {});
  }

  updateJob(id: string, patch: { hidden?: boolean; saved?: boolean }): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${API}/jobs/${encodeURIComponent(id)}`, patch);
  }

  stats(): Observable<Stats> {
    return this.http.get<Stats>(`${API}/jobs/stats`);
  }

  getSettings(): Observable<Settings> {
    return this.http.get<Settings>(`${API}/settings`);
  }

  saveSettings(s: Settings): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${API}/settings`, s);
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
