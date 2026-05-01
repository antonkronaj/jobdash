import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-stopwords-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stopwords-modal.component.html',
  styleUrl: './stopwords-modal.component.css',
})
export class StopwordsModalComponent {
  isOpen = input<boolean>(false);
  words = input<string[]>([]);
  saving = input<boolean>(false);

  close = output<void>();
  save = output<string[]>();

  draft = signal<string[]>([]);
  inputValue = signal('');

  // Tracks the previous open state so we only re-seed `draft` on the
  // transition from closed → open (not on every `words` change).
  private prevOpen = false;

  constructor() {
    effect(() => {
      // Read both signals unconditionally so the effect tracks both. Otherwise
      // an early run with isOpen=false would skip reading `words`, and later
      // updates to `words` would never trigger a re-run.
      const open = this.isOpen();
      const words = this.words();
      if (open && !this.prevOpen) {
        this.draft.set([...words]);
        this.inputValue.set('');
      }
      this.prevOpen = open;
    }, { allowSignalWrites: true });
  }

  onClose() {
    this.close.emit();
  }

  // Add words from the input. Accepts comma/space-separated values for fast paste.
  commitInput() {
    const raw = this.inputValue();
    const parts = raw
      .split(/[\s,]+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0);
    if (parts.length === 0) return;

    this.draft.update((current) => {
      const set = new Set(current);
      for (const p of parts) set.add(p);
      return [...set];
    });
    this.inputValue.set('');
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      event.preventDefault();
      this.commitInput();
    } else if (event.key === 'Backspace' && this.inputValue() === '' && this.draft().length > 0) {
      this.draft.update((d) => d.slice(0, -1));
    }
  }

  removeWord(word: string) {
    this.draft.update((d) => d.filter((w) => w !== word));
  }

  onSave() {
    this.commitInput();
    this.save.emit(this.draft());
  }
}
