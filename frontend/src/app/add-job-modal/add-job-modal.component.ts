import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Job } from '../api.service';

@Component({
  selector: 'app-add-job-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-job-modal.component.html',
  styleUrl: './add-job-modal.component.css'
})
export class AddJobModalComponent {
  isOpen = input<boolean>(false);
  jobToEdit = input<Job | null>(null);
  close = output<void>();
  save = output<any>();

  draft = signal({
    title: '',
    company: '',
    location: '',
    remote: false,
    url: '',
    description: '',
    salary: '',
    postedAt: new Date().toISOString().slice(0, 10),
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const job = this.jobToEdit();
        if (job) {
          this.draft.set({
            title: job.title || '',
            company: job.company || '',
            location: job.location || '',
            remote: job.remote || false,
            url: job.url || '',
            description: job.description || '',
            salary: job.salary || '',
            postedAt: job.postedAt ? job.postedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
          });
        } else {
          this.reset();
        }
      }
    }, { allowSignalWrites: true });
  }

  updateDraft(patch: any) {
    this.draft.set({ ...this.draft(), ...patch });
  }

  onClose() {
    this.close.emit();
  }

  onSave() {
    this.save.emit(this.draft());
  }

  reset() {
    this.draft.set({
      title: '',
      company: '',
      location: '',
      remote: false,
      url: '',
      description: '',
      salary: '',
      postedAt: new Date().toISOString().slice(0, 10),
    });
  }
}
