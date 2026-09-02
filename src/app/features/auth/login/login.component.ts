import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { AuthService } from '../../../core/services/auth.service';
import { LocaleService } from '../../../core/services/locale.service';
import { ValidationErrorBody } from '../../../core/models/api-response.model';

type Field = 'email' | 'password';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly submitting = signal(false);
  readonly passwordVisible = signal(false);
  readonly formError = signal<string | null>(null);

  togglePassword(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }

    // A server error leaves the control invalid, so it has to go before the
    // validity check or a corrected value could never be resubmitted.
    this.clearServerErrors();
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.applyServerError(error);
      },
    });
  }

  fieldError(field: Field): string | null {
    const control = this.form.controls[field];

    if (control.hasError('server')) {
      return control.getError('server');
    }

    if (!control.touched) {
      return null;
    }

    if (control.hasError('required')) {
      return this.locale.translate(
        field === 'email' ? 'login.emailRequired' : 'login.passwordRequired',
      );
    }

    return control.hasError('email') ? this.locale.translate('login.emailInvalid') : null;
  }

  private applyServerError(error: HttpErrorResponse): void {
    if (error.status === 422) {
      const body = error.error as ValidationErrorBody;
      const errors = body?.errors ?? {};

      Object.entries(errors).forEach(([field, messages]) => {
        this.form.get(field)?.setErrors({ server: messages[0] });
      });

      if (Object.keys(errors).length === 0) {
        this.formError.set(body?.message ?? this.locale.translate('login.failed'));
      }

      return;
    }

    // 403 is a deactivated account. The interceptor leaves it to us rather than
    // sending the visitor to /403, which they could not read anyway.
    this.formError.set(
      error.status === 403
        ? (error.error?.message ?? this.locale.translate('login.deactivated'))
        : this.locale.translate('login.failed'),
    );
  }

  private clearServerErrors(): void {
    (Object.keys(this.form.controls) as Field[]).forEach((field) => {
      const control = this.form.controls[field];

      if (control.hasError('server')) {
        control.setErrors(null);
        control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      }
    });
  }
}
