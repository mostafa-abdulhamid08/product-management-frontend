import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ValidationErrorBody } from '../../../../core/models/api-response.model';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  matrixActions,
  PermissionMatrix,
  permissionKey,
  PROTECTED_ROLE,
  Role,
} from '../../models/role.model';
import { RoleService } from '../../services/role.service';

@Component({
  selector: 'app-role-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    TranslatePipe,
  ],
  templateUrl: './role-form.component.html',
})
export class RoleFormComponent implements OnInit {
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LocaleService);

  readonly id = input<string | undefined>(undefined);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(255)]],
  });

  /** The selected permission keys. Signals, not a form control — the matrix is a grid. */
  readonly selected = signal<Set<string>>(new Set());
  readonly matrix = signal<PermissionMatrix>({});

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly missing = signal(false);
  readonly blocked = signal(false);
  readonly formError = signal<string | null>(null);

  readonly resources = computed(() => Object.keys(this.matrix()));
  readonly actions = computed(() => matrixActions(this.matrix()));

  readonly roleId = computed(() => {
    const parsed = Number(this.id());

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  readonly isEdit = computed(() => this.roleId() !== null);
  readonly headingKey = computed(() => (this.isEdit() ? 'roles.editTitle' : 'roles.addTitle'));

  /** Identifier in, label out. An unknown one prints as itself. */
  actionLabel(action: string): string {
    const key = `roles.actions.${action}`;
    const label = this.locale.translate(key);

    return label === key ? action : label;
  }

  resourceLabel(resource: string): string {
    const key = `roles.resources.${resource}`;
    const label = this.locale.translate(key);

    return label === key ? resource : label;
  }
  readonly selectedCount = computed(() => this.selected().size);
  readonly totalCount = computed(() =>
    Object.values(this.matrix()).reduce((sum, actions) => sum + actions.length, 0),
  );

  ngOnInit(): void {
    this.roles.permissionMatrix().subscribe({
      next: (matrix) => this.matrix.set(matrix),
      error: () => this.matrix.set({}),
    });

    if (!this.isEdit()) {
      return;
    }

    this.loading.set(true);

    this.roles.getById(this.roleId()!).subscribe({
      next: (role) => {
        // super-admin is protected by the API; refuse the screen rather than
        // let someone fill in a form the server will reject.
        if (role.name === PROTECTED_ROLE) {
          this.blocked.set(true);
          this.loading.set(false);

          return;
        }

        this.fill(role);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.missing.set(error.status === 404);
        this.loading.set(false);
      },
    });
  }

  private fill(role: Role): void {
    this.form.patchValue({
      name: role.name,
      description: role.description ?? '',
    });

    this.selected.set(new Set(role.permissions));
  }

  isChecked(resource: string, action: string): boolean {
    return this.selected().has(permissionKey(resource, action));
  }

  toggle(resource: string, action: string): void {
    this.update((next) => {
      const key = permissionKey(resource, action);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
    });
  }

  /** Every action on one resource. */
  isRowFull(resource: string): boolean {
    const actions = this.matrix()[resource] ?? [];

    return actions.length > 0 && actions.every((action) => this.isChecked(resource, action));
  }

  toggleRow(resource: string): void {
    const turnOn = !this.isRowFull(resource);

    this.update((next) => {
      (this.matrix()[resource] ?? []).forEach((action) => {
        const key = permissionKey(resource, action);

        if (turnOn) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
    });
  }

  /** One action across every resource. */
  isColumnFull(action: string): boolean {
    const resources = this.resources().filter((resource) =>
      (this.matrix()[resource] ?? []).includes(action),
    );

    return resources.length > 0 && resources.every((resource) => this.isChecked(resource, action));
  }

  toggleColumn(action: string): void {
    const turnOn = !this.isColumnFull(action);

    this.update((next) => {
      this.resources().forEach((resource) => {
        if (!(this.matrix()[resource] ?? []).includes(action)) {
          return;
        }

        const key = permissionKey(resource, action);

        if (turnOn) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
    });
  }

  private update(mutate: (next: Set<string>) => void): void {
    this.selected.update((current) => {
      const next = new Set(current);

      mutate(next);

      return next;
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
    const payload = {
      name: value.name,
      description: value.description.trim() === '' ? null : value.description,
      permissions: [...this.selected()],
    };

    const request = this.isEdit()
      ? this.roles.update(this.roleId()!, payload)
      : this.roles.create(payload);

    request.subscribe({
      next: (role) => {
        this.toast.show(
          'success',
          this.locale.translate('roles.saved', { name: role.display_name }),
        );
        this.router.navigateByUrl('/roles');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.applyServerError(error);
      },
    });
  }

  private applyServerError(error: HttpErrorResponse): void {
    if (error.status !== 422) {
      this.formError.set(this.locale.translate('roles.saveFailed'));

      return;
    }

    const body = error.error as ValidationErrorBody;
    const errors = body?.errors ?? {};
    let unmapped: string | null = body?.message ?? null;

    Object.entries(errors).forEach(([field, messages]) => {
      const control = this.form.get(field);

      if (control) {
        control.setErrors({ server: messages[0] });
        unmapped = null;

        return;
      }

      // `permissions` and `permissions.3` have no control to attach to.
      unmapped = messages[0];
    });

    this.formError.set(unmapped);
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
      return this.locale.translate('common.requiredField');
    }

    return control.hasError('maxlength') ? this.locale.translate('common.maxLength') : null;
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
