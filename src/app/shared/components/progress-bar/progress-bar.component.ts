import { Component, input } from '@angular/core';

/** Dumb on purpose: it is told when to show, and knows nothing about why. */
@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.css',
})
export class ProgressBarComponent {
  readonly active = input.required<boolean>();
}
