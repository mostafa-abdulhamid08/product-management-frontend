import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { PaginationMeta } from '../../../../core/models/api-response.model';
import { LocaleService } from '../../../../core/services/locale.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  DataTableColumn,
  DataTableComponent,
} from '../../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import {
  EMPTY_USER_FILTERS,
  hasActiveUserFilters,
  RoleOption,
  UserFilters,
  UserRecord,
  UserStatus,
} from '../../models/user-record.model';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-list',
  imports: [
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    DataTableComponent,
    StatusBadgeComponent,
    ConfirmDialogComponent,
    TranslatePipe,
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LocaleService);

  private readonly searchInput = new Subject<string>();

  readonly filters = signal<UserFilters>({ ...EMPTY_USER_FILTERS });
  readonly rows = signal<UserRecord[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly roles = signal<RoleOption[]>([]);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly pendingDelete = signal<UserRecord | null>(null);
  readonly deleting = signal(false);
  readonly togglingId = signal<number | null>(null);

  readonly filtered = computed(() => hasActiveUserFilters(this.filters()));

  /** Computed, not static: switching language has to re-label the header. */
  readonly columns = computed<DataTableColumn[]>(() => [
    { label: this.locale.translate('common.name') },
    { label: this.locale.translate('common.email') },
    { label: this.locale.translate('common.role') },
    { label: this.locale.translate('common.status'), width: 'w-28' },
  ]);

  /** The backend refuses these too; hiding them first saves a pointless 422. */
  private readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  constructor() {
    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.patch({ search, page: 1 }));
  }

  ngOnInit(): void {
    this.load();
    this.users.roleOptions().subscribe({
      next: (options) => this.roles.set(options),
      error: () => this.roles.set([]),
    });
  }

  isSelf(user: UserRecord): boolean {
    return user.id === this.currentUserId();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.users.getAll(this.filters()).subscribe({
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

  onSearch(value: string): void {
    this.searchInput.next(value);
  }

  onRole(value: string): void {
    this.patch({ role: value === '' ? null : value, page: 1 });
  }

  onStatus(value: string): void {
    this.patch({ status: value === '' ? null : (value as UserStatus), page: 1 });
  }

  onPage(page: number): void {
    this.patch({ page });
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_USER_FILTERS });
    this.load();
  }

  toggleStatus(user: UserRecord): void {
    if (this.togglingId() !== null) {
      return;
    }

    this.togglingId.set(user.id);

    this.users.toggleStatus(user.id).subscribe({
      next: (updated) => {
        this.togglingId.set(null);
        this.rows.update((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      },
      error: (error: HttpErrorResponse) => {
        this.togglingId.set(null);

        // Self-protection rules: you cannot deactivate yourself, and the last
        // active super admin cannot be switched off. The row stays as it was.
        if (error.status === 422) {
          this.toast.show(
            'error',
            error.error?.message ?? this.locale.translate('users.toggleRefused'),
          );
        }
      },
    });
  }

  askDelete(user: UserRecord): void {
    this.pendingDelete.set(user);
  }

  confirmDelete(): void {
    const user = this.pendingDelete();

    if (!user) {
      return;
    }

    this.deleting.set(true);

    this.users.delete(user.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.toast.show('success', this.locale.translate('users.deleted', { name: user.name }));
        this.afterDelete();
      },
      error: (error: HttpErrorResponse) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);

        if (error.status === 422) {
          this.toast.show(
            'error',
            error.error?.message ?? this.locale.translate('users.deleteFailed'),
          );
        }
      },
    });
  }

  private afterDelete(): void {
    const meta = this.meta();
    const wasLastOnPage = this.rows().length === 1 && meta !== null && meta.current_page > 1;

    if (wasLastOnPage) {
      this.patch({ page: meta.current_page - 1 });

      return;
    }

    this.load();
  }

  private patch(change: Partial<UserFilters>): void {
    this.filters.update((current) => ({ ...current, ...change }));
    this.load();
  }
}
