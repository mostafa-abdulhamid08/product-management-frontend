import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { PaginationMeta } from '../../../../core/models/api-response.model';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  DataTableColumn,
  DataTableComponent,
} from '../../../../shared/components/data-table/data-table.component';
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
  selector: 'app-role-list',
  imports: [
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    DataTableComponent,
    ConfirmDialogComponent,
    TranslatePipe,
  ],
  templateUrl: './role-list.component.html',
})
export class RoleListComponent implements OnInit {
  private readonly roles = inject(RoleService);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LocaleService);

  readonly rows = signal<Role[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly matrix = signal<PermissionMatrix>({});
  readonly page = signal(1);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly expandedId = signal<number | null>(null);
  readonly pendingDelete = signal<Role | null>(null);
  readonly deleting = signal(false);

  readonly resources = computed(() => Object.keys(this.matrix()));
  readonly actions = computed(() => matrixActions(this.matrix()));
  readonly resourceCount = computed(() => this.resources().length);

  /** Built from the matrix, so a new resource or action needs no change here. */
  readonly columns = computed<DataTableColumn[]>(() => [
    { label: this.locale.translate('roles.role') },
    ...this.actions().map((action) => ({
      label: this.actionLabel(action),
      align: 'center' as const,
      width: 'w-24',
    })),
    { label: this.locale.translate('roles.usersCount'), align: 'end', width: 'w-20' },
    { label: this.locale.translate('common.actions'), align: 'end', width: 'w-24' },
  ]);

  /**
   * An action is an identifier from the API. Only its label is translated, and
   * an action we have no wording for falls back to the identifier itself.
   */
  actionLabel(action: string): string {
    const key = `roles.actions.${action}`;
    const label = this.locale.translate(key);

    return label === key ? action : label;
  }

  /** Same split for a resource: `products` is a key, "Products" is a label. */
  resourceLabel(resource: string): string {
    const key = `roles.resources.${resource}`;
    const label = this.locale.translate(key);

    return label === key ? resource : label;
  }

  ngOnInit(): void {
    this.load();
    this.roles.permissionMatrix().subscribe({
      next: (matrix) => this.matrix.set(matrix),
      error: () => this.matrix.set({}),
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.roles.getAll(this.page()).subscribe({
      next: (page) => {
        this.rows.set(page.data);
        this.meta.set(page.meta);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.meta.set(null);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  onPage(page: number): void {
    this.page.set(page);
    this.expandedId.set(null);
    this.load();
  }

  toggleExpanded(role: Role): void {
    this.expandedId.update((current) => (current === role.id ? null : role.id));
  }

  /** `super-admin` cannot be edited or deleted. Protected, but still listed. */
  isProtected(role: Role): boolean {
    return role.name === PROTECTED_ROLE;
  }

  has(role: Role, resource: string, action: string): boolean {
    return role.permissions.includes(permissionKey(resource, action));
  }

  /** How many of the resources this role holds `action` for — out of four. */
  actionCount(role: Role, action: string): number {
    return this.resources().filter((resource) => this.has(role, resource, action)).length;
  }

  askDelete(role: Role): void {
    this.pendingDelete.set(role);
  }

  confirmDelete(): void {
    const role = this.pendingDelete();

    if (!role) {
      return;
    }

    this.deleting.set(true);

    this.roles.delete(role.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.toast.show(
          'success',
          this.locale.translate('roles.deleted', { name: role.display_name }),
        );
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);

        // A role still assigned to someone cannot be deleted, and super-admin
        // never can. Both come back as a worded refusal.
        if (error.status === 422) {
          this.toast.show(
            'error',
            error.error?.message ?? this.locale.translate('roles.deleteFailed'),
          );
        }
      },
    });
  }
}
