import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Settings, ResumeInfo, ApiKeysStatus, ApiKeysUpdate } from '../api.service';

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
  uploading = input<boolean>(false);

  close = output<void>();
  saveSettings = output<Settings>();
  uploadResume = output<File>();
  saveKeys = output<ApiKeysUpdate>();

  keysDraft = signal<ApiKeysUpdate>({});

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
}
