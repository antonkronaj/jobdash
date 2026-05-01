import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { ApiService, Job, Settings, ResumeInfo, Stats, ApiKeysStatus, ApiKeysUpdate, RefreshEvent } from './api.service';

import { SidebarComponent } from './sidebar/sidebar.component';
import { StatusBarComponent } from './status-bar/status-bar.component';
import { AddJobModalComponent } from './add-job-modal/add-job-modal.component';
import { SettingsDrawerComponent } from './settings-drawer/settings-drawer.component';
import { StopwordsModalComponent } from './stopwords-modal/stopwords-modal.component';

import { JobCardComponent } from './job-card/job-card.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule, SidebarComponent, StatusBarComponent, AddJobModalComponent, SettingsDrawerComponent, StopwordsModalComponent, JobCardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);

  jobs = signal<Job[]>([]);
  resume = signal<ResumeInfo>({ uploaded: false });
  settings = signal<Settings>({ title: '', location: '', includeRemote: true });
  stats = signal<Stats | null>(null);
  sources = signal<{ source: string; count: number }[]>([]);
  keys = signal<ApiKeysStatus>({ adzunaAppId: false, adzunaAppKey: false, adzunaCountry: 'us', findworkApiKey: false });
  termBoosts = signal<Record<string, number>>({});
  savingBoosts = signal(false);
  stopwords = signal<string[]>([]);
  savingStopwords = signal(false);
  stopwordsOpen = signal(false);
  settingsOpen = signal(false);
  addOpen = signal(false);
  jobToEdit = signal<Job | null>(null);

  showHidden = signal(false);
  savedOnly = signal(false);
  appliedOnly = signal(false);
  minScore = signal(0);
  selectedSource = signal<string | null>(null);
  usOnly = signal(false);
  postedWithin = signal<number | null>(null);
  searchText = signal('');
  loading = signal(false);
  refreshing = signal(false);
  uploading = signal(false);
  message = signal<string>('');
  expandedId = signal<string | null>(null);
  applyingId = signal<string | null>(null);
  applyDraft = signal<{ appliedAt: string; notes: string }>({ appliedAt: '', notes: '' });

  private static readonly US_RE = /United States|USA|\bUS\b|Remote\s*US|,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i;

  private isUS(job: Job): boolean {
    if (job.source === 'adzuna') return true;
    if (job.source === 'manual') return true;
    if (!job.location) return true;
    const loc = job.location;
    if (/^(Remote|Flexible \/ Remote)$/i.test(loc.trim())) return true;
    return AppComponent.US_RE.test(loc);
  }

  visibleJobs = computed(() => {
    let jobs = this.jobs();
    const src = this.selectedSource();
    const days = this.postedWithin();
    const q = this.searchText().trim().toLowerCase();
    if (src) jobs = jobs.filter((j) => j.source === src);
    if (this.usOnly()) jobs = jobs.filter((j) => this.isUS(j));
    if (days) {
      const cutoff = Date.now() - days * 864e5;
      jobs = jobs.filter((j) => j.postedAt && new Date(j.postedAt).getTime() >= cutoff);
    }
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      jobs = jobs.filter((j) => {
        const haystack = [
          j.title,
          j.company ?? '',
          j.location ?? '',
          ...j.matchedTerms,
        ].join(' ').toLowerCase();
        return terms.every((t) => haystack.includes(t));
      });
    }
    return jobs;
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loadJobs();
    this.api.getResume().subscribe((r) => this.resume.set(r));
    this.api.getSettings().subscribe((s) => this.settings.set(s));
    this.api.stats().subscribe((s) => this.stats.set(s));
    this.api.getSources().subscribe((s) => this.sources.set(s));
    this.api.getKeys().subscribe((k) => this.keys.set(k));
    this.api.getTermBoosts().subscribe((r) => this.termBoosts.set(r.boosts));
    this.api.getStopwords().subscribe((r) => this.stopwords.set(r.words));
  }

  openStopwordsModal(): void {
    // Always re-fetch on open so the modal reflects what's in the db right now,
    // independent of when (or whether) the initial load on app start succeeded.
    this.api.getStopwords().subscribe({
      next: (r) => {
        this.stopwords.set(r.words);
        this.stopwordsOpen.set(true);
      },
      error: (err) => {
        this.message.set(`Failed to load stopwords: ${err.message ?? err}`);
      },
    });
  }

  onSaveStopwords(words: string[]): void {
    this.savingStopwords.set(true);
    this.api.saveStopwords(words).subscribe({
      next: (r) => {
        this.savingStopwords.set(false);
        this.stopwords.set(words);
        this.stopwordsOpen.set(false);
        this.message.set(`Saved ${r.count} stopwords. Rescored ${r.rescored} jobs.`);
        this.loadJobs();
      },
      error: (err) => {
        this.savingStopwords.set(false);
        this.message.set(`Failed to save stopwords: ${err.error?.error ?? err.message ?? err}`);
      },
    });
  }

  onSaveTermBoosts(boosts: Record<string, number>): void {
    this.savingBoosts.set(true);
    this.api.saveTermBoosts(boosts).subscribe({
      next: (r) => {
        this.savingBoosts.set(false);
        this.termBoosts.set(boosts);
        this.message.set(`Term boosts saved. Rescored ${r.rescored} jobs.`);
        this.loadJobs();
      },
      error: (err) => {
        this.savingBoosts.set(false);
        this.message.set(`Failed to save boosts: ${err.error?.error ?? err.message ?? err}`);
      },
    });
  }

  onSaveKeys(patch: ApiKeysUpdate): void {
    if (Object.keys(patch).length === 0) {
      return;
    }
    this.api.saveKeys(patch).subscribe(() => {
      this.message.set('API keys saved.');
      this.api.getKeys().subscribe((k) => this.keys.set(k));
    });
  }


  loadJobs(): void {
    this.loading.set(true);
    this.api
      .listJobs({
        showHidden: this.showHidden(),
        savedOnly: this.savedOnly(),
        appliedOnly: this.appliedOnly(),
        minScore: this.minScore(),
      })
      .subscribe({
        next: (jobs) => {
          this.jobs.set(jobs);
          this.loading.set(false);
        },
        error: (err) => {
          this.message.set(`Error loading jobs: ${err.message ?? err}`);
          this.loading.set(false);
        },
      });
  }

  refresh(): void {
    this.refreshing.set(true);
    const sourceCounts = new Map<string, { count: number; error?: string }>();

    const buildMessage = () => {
      if (sourceCounts.size === 0) return 'Fetching…';
      return [...sourceCounts.entries()]
        .map(([src, { count, error }]) =>
          error ? `${src}: ✕` : `${src}: ${count}`)
        .join('  ·  ');
    };

    this.message.set('Fetching…');

    this.api.refresh().subscribe({
      next: (event: RefreshEvent) => {
        if (event.type === 'source') {
          sourceCounts.set(event.source, { count: event.count, error: event.error });
          this.message.set(buildMessage());
        } else if (event.type === 'done') {
          this.message.set(`Fetched ${event.fetched} jobs (${event.added} new)`);
          this.refreshing.set(false);
          this.loadJobs();
          this.api.stats().subscribe((s) => this.stats.set(s));
          this.api.getSources().subscribe((s) => this.sources.set(s));
        } else if (event.type === 'error') {
          this.message.set(`Refresh failed: ${event.error}`);
          this.refreshing.set(false);
        }
      },
      error: (err) => {
        this.message.set(`Refresh failed: ${err.message ?? err}`);
        this.refreshing.set(false);
      },
    });
  }

  onFileSelected(file: File): void {
    if (!file) return;
    this.uploading.set(true);
    this.message.set('Parsing resume and rescoring jobs…');
    this.api.uploadResume(file).subscribe({
      next: (r) => {
        this.message.set(`Resume uploaded (${r.termCount} terms). Rescored ${r.rescored} jobs.`);
        this.uploading.set(false);
        this.api.getResume().subscribe((res) => this.resume.set(res));
        this.loadJobs();
      },
      error: (err) => {
        this.message.set(`Upload failed: ${err.error?.error ?? err.message ?? err}`);
        this.uploading.set(false);
      },
    });
  }

  onResumeSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.onFileSelected(file);
  }

  onSaveSettings(s: Settings): void {
    this.api.saveSettings(s).subscribe(() => {
      this.settings.set(s);
      this.message.set('Settings saved. Click Refresh to apply.');
    });
  }


  hide(job: Job): void {
    this.api.updateJob(job.id, { hidden: true }).subscribe(() => {
      this.loadJobs();
      this.api.stats().subscribe((s) => this.stats.set(s));
    });
  }

  toggleSave(job: Job): void {
    this.api.updateJob(job.id, { saved: !job.saved }).subscribe(() => {
      this.loadJobs();
      this.api.stats().subscribe((s) => this.stats.set(s));
    });
  }

  unhide(job: Job): void {
    this.api.updateJob(job.id, { hidden: false }).subscribe(() => {
      this.loadJobs();
      this.api.stats().subscribe((s) => this.stats.set(s));
    });
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  setApplyDate(v: string)  { this.applyDraft.update(d => ({ ...d, appliedAt: v })); }
  setApplyNotes(v: string) { this.applyDraft.update(d => ({ ...d, notes: v })); }

  openApply(job: Job): void {
    this.applyingId.set(job.id);
    this.applyDraft.set({
      appliedAt: job.appliedAt ?? new Date().toISOString().slice(0, 10),
      notes: job.notes ?? '',
    });
  }

  saveApply(job: Job): void {
    const { appliedAt, notes } = this.applyDraft();
    this.api.updateJob(job.id, {
      applied: true,
      appliedAt: appliedAt || null,
      notes: notes || null,
    }).subscribe(() => {
      this.applyingId.set(null);
      this.loadJobs();
      this.api.stats().subscribe((s) => this.stats.set(s));
    });
  }

  onSaveManualJob(draft: any): void {
    if (!draft.title) {
      this.message.set('Title is required');
      return;
    }
    const editJob = this.jobToEdit();
    if (editJob) {
      this.api.updateJob(editJob.id, draft).subscribe({
        next: () => {
          this.message.set('Job updated successfully');
          this.addOpen.set(false);
          this.jobToEdit.set(null);
          this.loadJobs();
          this.api.stats().subscribe((s) => this.stats.set(s));
          this.api.getSources().subscribe((s) => this.sources.set(s));
        },
        error: (err) => {
          this.message.set(`Failed to update job: ${err.error?.error ?? (err.message || 'Unknown error')}`);
        },
      });
    } else {
      this.api.addJob(draft).subscribe({
        next: () => {
          this.message.set('Job added successfully');
          this.addOpen.set(false);
          this.loadJobs();
          this.api.stats().subscribe((s) => this.stats.set(s));
          this.api.getSources().subscribe((s) => this.sources.set(s));
        },
        error: (err) => {
          this.message.set(`Failed to add job: ${err.error?.error ?? (err.message || 'Unknown error')}`);
        },
      });
    }
  }

  openAddModal() {
    this.jobToEdit.set(null);
    this.addOpen.set(true);
  }

  openEditModal(job: Job) {
    this.jobToEdit.set(job);
    this.addOpen.set(true);
  }


  unapply(job: Job): void {
    this.api.updateJob(job.id, { applied: false, appliedAt: null }).subscribe(() => {
      this.loadJobs();
      this.api.stats().subscribe((s) => this.stats.set(s));
    });
  }
}
