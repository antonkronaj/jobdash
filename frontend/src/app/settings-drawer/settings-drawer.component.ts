import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Settings, ResumeInfo, ApiKeysStatus, ApiKeysUpdate } from '../api.service';

interface BoostRow { term: string; weight: number; }

@Component({
  selector: 'app-settings-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-drawer.component.html',
  styleUrl: './settings-drawer.component.css'
})
export class SettingsDrawerComponent {
  isOpen = input<boolean>(false);
  settings = input.required<Settings>();
  resume = input.required<ResumeInfo>();
  keys = input.required<ApiKeysStatus>();
  termBoosts = input<Record<string, number>>({});
  uploading = input<boolean>(false);
  savingBoosts = input<boolean>(false);

  close = output<void>();
  saveSettings = output<Settings>();
  uploadResume = output<File>();
  saveKeys = output<ApiKeysUpdate>();
  saveTermBoosts = output<Record<string, number>>();
  openStopwords = output<void>();

  keysDraft = signal<ApiKeysUpdate>({});
  boostRows = signal<BoostRow[]>([]);

  constructor() {
    // Sync incoming term boosts into editable rows whenever they change.
    effect(() => {
      const map = this.termBoosts();
      const rows = Object.entries(map)
        .map(([term, weight]) => ({ term, weight }))
        .sort((a, b) => b.weight - a.weight);
      this.boostRows.set(rows);
    }, { allowSignalWrites: true });
  }

  onClose() {
    this.close.emit();
  }

  updateSetting(field: keyof Settings, value: any) {
    this.saveSettings.emit({ ...this.settings(), [field]: value });
  }

  onResumeSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.uploadResume.emit(file);
    }
  }

  updateKeyDraft(field: keyof ApiKeysUpdate, value: string) {
    this.keysDraft.update(d => ({ ...d, [field]: value }));
  }

  onSaveKeys() {
    this.saveKeys.emit(this.keysDraft());
    this.keysDraft.set({});
  }

  addBoostRow() {
    this.boostRows.update(rows => [...rows, { term: '', weight: 2 }]);
  }

  removeBoostRow(index: number) {
    this.boostRows.update(rows => rows.filter((_, i) => i !== index));
  }

  updateBoostTerm(index: number, term: string) {
    this.boostRows.update(rows => rows.map((r, i) => i === index ? { ...r, term } : r));
  }

  updateBoostWeight(index: number, weight: number) {
    this.boostRows.update(rows => rows.map((r, i) => i === index ? { ...r, weight } : r));
  }

  onSaveBoosts() {
    const map: Record<string, number> = {};
    for (const { term, weight } of this.boostRows()) {
      const t = term.trim().toLowerCase();
      if (t && Number.isFinite(weight) && weight > 0) map[t] = weight;
    }
    this.saveTermBoosts.emit(map);
  }

  trackByIndex(index: number) {
    return index;
  }
}
