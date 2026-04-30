import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-add-job-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './add-job-modal.component.html',
  styleUrl: './add-job-modal.component.css'
})
export class AddJobModalComponent {
  isOpen = input<boolean>(false);
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
