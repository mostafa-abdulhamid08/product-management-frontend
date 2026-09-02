import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { TranslatePipe } from './core/pipes/translate.pipe';
import { ProgressService } from './core/services/progress.service';
import { ToastService } from './core/services/toast.service';
import { ProgressBarComponent } from './shared/components/progress-bar/progress-bar.component';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, ProgressBarComponent, TranslatePipe],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly toast = inject(ToastService);

  readonly toasts = this.toast.toasts;
  readonly loading = inject(ProgressService).visible;

  dismiss(id: number): void {
    this.toast.dismiss(id);
  }
}
