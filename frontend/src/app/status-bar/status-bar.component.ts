import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Stats } from '../api.service';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.css'
})
export class StatusBarComponent {
  stats = input<Stats | null>(null);
}
