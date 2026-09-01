import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly toast = inject(ToastService);

  readonly toasts = this.toast.toasts;

  dismiss(id: number): void {
    this.toast.dismiss(id);
  }
}
