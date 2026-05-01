import { Component, Input, Output, EventEmitter, WritableSignal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Stats } from '../api.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  @Input({ required: true }) searchText!: WritableSignal<string>;
  @Input({ required: true }) savedOnly!: WritableSignal<boolean>;
  @Input({ required: true }) appliedOnly!: WritableSignal<boolean>;
  @Input({ required: true }) showHidden!: WritableSignal<boolean>;
  @Input({ required: true }) usOnly!: WritableSignal<boolean>;
  @Input({ required: true }) postedWithin!: WritableSignal<number | null>;
  @Input({ required: true }) minScore!: WritableSignal<number>;
  @Input({ required: true }) selectedSource!: WritableSignal<string | null>;
  @Input({ required: true }) stats!: Signal<Stats | null>;
  @Input({ required: true }) sources!: Signal<{ source: string; count: number }[]>;
  @Input({ required: true }) refreshing!: Signal<boolean>;

  @Output() filterChanged = new EventEmitter<void>();

  scorePct(score: number): number {
    return Math.round(score * 100);
  }

  onFilterClick() {
    this.filterChanged.emit();
  }
}
