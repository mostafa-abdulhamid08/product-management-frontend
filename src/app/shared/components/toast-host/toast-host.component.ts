import { Component, input, output } from '@angular/core';

import { Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  templateUrl: './toast-host.component.html',
})
export class ToastHostComponent {
  readonly toasts = input.required<Toast[]>();
  readonly dismissed = output<number>();
}
