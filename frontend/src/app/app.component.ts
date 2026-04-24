import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Job, Settings, ResumeInfo, Stats } from './api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);

  jobs = signal<Job[]>([]);
  resume = signal<ResumeInfo>({ uploaded: false });
  settings = signal<Settings>({ title: '', location: '', includeRemote: true });
  stats = signal<Stats | null>(null);

  showHidden = signal(false);
  savedOnly = signal(false);
  minScore = signal(0);
  loading = signal(false);
  refreshing = signal(false);
  uploading = signal(false);
  message = signal<string>('');
  expandedId = signal<string | null>(null);

  visibleJobs = computed(() => this.jobs());

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loadJobs();
    this.api.getResume().subscribe((r) => this.resume.set(r));
    this.api.getSettings().subscribe((s) => this.settings.set(s));
    this.api.stats().subscribe((s) => this.stats.set(s));
  }

  loadJobs(): void {
    this.loading.set(true);
    this.api
      .listJobs({
        showHidden: this.showHidden(),
        savedOnly: this.savedOnly(),
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
    this.message.set('Fetching jobs from Adzuna, The Muse, RemoteOK…');
    this.api.refresh().subscribe({
      next: (r) => {
        this.message.set(`Fetched ${r.fetched} jobs (${r.added} new)`);
        this.refreshing.set(false);
        this.loadJobs();
        this.api.stats().subscribe((s) => this.stats.set(s));
      },
      error: (err) => {
        this.message.set(`Refresh failed: ${err.message ?? err}`);
        this.refreshing.set(false);
      },
    });
  }

  onResumeSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
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

  saveSettings(): void {
    this.api.saveSettings(this.settings()).subscribe(() => {
      this.message.set('Settings saved. Click Refresh to apply.');
    });
  }

  hide(job: Job): void {
    this.api.updateJob(job.id, { hidden: true }).subscribe(() => this.loadJobs());
  }

  toggleSave(job: Job): void {
    this.api.updateJob(job.id, { saved: !job.saved }).subscribe(() => this.loadJobs());
  }

  unhide(job: Job): void {
    this.api.updateJob(job.id, { hidden: false }).subscribe(() => this.loadJobs());
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  scorePct(score: number): number {
    return Math.round(score * 100);
  }

  scoreColor(score: number): string {
    if (score >= 0.5) return '#10b981';
    if (score >= 0.3) return '#f59e0b';
    return '#94a3b8';
  }

  updateTitle(v: string) { this.settings.update((s) => ({ ...s, title: v })); }
  updateLocation(v: string) { this.settings.update((s) => ({ ...s, location: v })); }
  updateIncludeRemote(v: boolean) { this.settings.update((s) => ({ ...s, includeRemote: v })); }
}
