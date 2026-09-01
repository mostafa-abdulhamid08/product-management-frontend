import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ValidationErrorBody } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { RoleOption, UserRecord } from '../../models/user-record.model';
import { UserPayload, UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input<string | undefined>(undefined);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['', [Validators.required]],
    password: ['', [Validators.minLength(8)]],
    password_confirmation: [''],
  });

  readonly roles = signal<RoleOption[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly missing = signal(false);
  readonly formError = signal<string | null>(null);

  readonly userId = computed(() => {
    const parsed = Number(this.id());

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  readonly isEdit = computed(() => this.userId() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Edit user' : 'Add user'));

  ngOnInit(): void {
    this.users.roleOptions().subscribe({
      next: (options) => this.roles.set(options),
      error: () => this.roles.set([]),
    });

    if (!this.isEdit()) {
      // Only required when creating. On edit it is left blank to keep the
      // existing password, and only rehashed when something is typed.
      this.form.controls.password.addValidators(Validators.required);
      this.form.controls.password.updateValueAndValidity();

      return;
    }

    this.loading.set(true);

    this.users.getById(this.userId()!).subscribe({
      next: (user) => {
        this.fill(user);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.missing.set(error.status === 404);
        this.loading.set(false);
      },
    });
  }

  private fill(user: UserRecord): void {
    this.form.patchValue({
      name: user.name,
      email: user.email,
      // The key, not the display name — this is what the API matches on.
      role: user.role,
    });
  }

  submit(): void {
    if (this.saving()) {
      return;
    }

    this.clearServerErrors();
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();
    const payload: UserPayload = {
      name: value.name,
      email: value.email,
      role: value.role,
    };

    if (value.password !== '') {
      payload.password = value.password;
      payload.password_confirmation = value.password_confirmation;
    }

    const request = this.isEdit()
      ? this.users.update(this.userId()!, payload)
      : this.users.create(payload);

    request.subscribe({
      next: (user) => {
        this.toast.show('success', `${user.name} was saved.`);
        this.router.navigateByUrl('/users');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.applyServerError(error);
      },
    });
  }

  private applyServerError(error: HttpErrorResponse): void {
    if (error.status !== 422) {
      this.formError.set('Could not save this user. Please try again.');

      return;
    }

    const body = error.error as ValidationErrorBody;
    const errors = body?.errors ?? {};

    Object.entries(errors).forEach(([field, messages]) => {
      this.form.get(field)?.setErrors({ server: messages[0] });
    });

    // The last-active-super-admin rules come back as a message with no field,
    // because no single input is at fault.
    if (Object.keys(errors).length === 0) {
      this.formError.set(body?.message ?? 'Could not save this user.');
    }
  }

  fieldError(field: string): string | null {
    const control = this.form.get(field);

    if (!control) {
      return null;
    }

    if (control.hasError('server')) {
      return control.getError('server');
    }

    if (!control.touched) {
      return null;
    }

    if (control.hasError('required')) {
      return 'This field is required.';
    }

    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }

    return control.hasError('minlength') ? 'Use at least 8 characters.' : null;
  }

  private clearServerErrors(): void {
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);

      if (control?.hasError('server')) {
        control.setErrors(null);
        control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      }
    });
  }
}
