import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { Job } from '../api.service';

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './job-card.component.html',
  styleUrl: './job-card.component.css'
})
export class JobCardComponent {
  @Input({ required: true }) job!: Job;
  @Input({ required: true }) expanded = false;
  @Input({ required: true }) applying = false;
  @Input({ required: true }) applyDraft = { appliedAt: '', notes: '' };

  @Output() toggleExpand = new EventEmitter<string>();
  @Output() edit = new EventEmitter<Job>();
  @Output() toggleSave = new EventEmitter<Job>();
  @Output() openApply = new EventEmitter<Job>();
  @Output() unapply = new EventEmitter<Job>();
  @Output() hide = new EventEmitter<Job>();
  @Output() unhide = new EventEmitter<Job>();
  @Output() saveApply = new EventEmitter<Job>();
  @Output() cancelApply = new EventEmitter<void>();
  @Output() setApplyDate = new EventEmitter<string>();
  @Output() setApplyNotes = new EventEmitter<string>();

  scorePct(score: number): string {
    return Math.round(score * 100) + '%';
  }

  scoreColor(score: number): string {
    if (score >= 0.8) return '#22c55e'; // Green
    if (score >= 0.5) return '#eab308'; // Yellow
    if (score >= 0.3) return '#f97316'; // Orange
    return '#ef4444'; // Red
  }

  onToggleExpand() {
    this.toggleExpand.emit(this.job.id);
  }

  onEdit(event: Event) {
    event.stopPropagation();
    this.edit.emit(this.job);
  }

  onToggleSave(event: Event) {
    event.stopPropagation();
    this.toggleSave.emit(this.job);
  }

  onOpenApply(event: Event) {
    event.stopPropagation();
    this.openApply.emit(this.job);
  }

  onUnapply(event: Event) {
    event.stopPropagation();
    this.unapply.emit(this.job);
  }

  onHide(event: Event) {
    event.stopPropagation();
    this.hide.emit(this.job);
  }

  onUnhide(event: Event) {
    event.stopPropagation();
    this.unhide.emit(this.job);
  }

  onSaveApply(event: Event) {
    event.stopPropagation();
    this.saveApply.emit(this.job);
  }

  onCancelApply(event: Event) {
    event.stopPropagation();
    this.cancelApply.emit();
  }

  onSetApplyDate(v: string) {
    this.setApplyDate.emit(v);
  }

  onSetApplyNotes(v: string) {
    this.setApplyNotes.emit(v);
  }
}
