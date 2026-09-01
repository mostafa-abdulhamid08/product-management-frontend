import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { PaginationMeta } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  DataTableColumn,
  DataTableComponent,
} from '../../../../shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  Category,
  CategoryFilters,
  EMPTY_CATEGORY_FILTERS,
  hasActiveCategoryFilters,
} from '../../models/category.model';
import { CategoryService } from '../../services/category.service';

@Component({
  selector: 'app-category-list',
  imports: [
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    DataTableComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './category-list.component.html',
})
export class CategoryListComponent implements OnInit {
  private readonly categories = inject(CategoryService);
  private readonly toast = inject(ToastService);

  private readonly searchInput = new Subject<string>();

  readonly filters = signal<CategoryFilters>({ ...EMPTY_CATEGORY_FILTERS });
  readonly rows = signal<Category[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly pendingDelete = signal<Category | null>(null);
  readonly deleting = signal(false);

  readonly filtered = computed(() => hasActiveCategoryFilters(this.filters()));

  readonly columns: DataTableColumn[] = [
    { label: 'Category' },
    { label: 'Description' },
    { label: 'Products', align: 'end', width: 'w-28' },
    { label: 'Actions', align: 'end', width: 'w-24' },
  ];

  constructor() {
    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.patch({ search, page: 1 }));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.categories.getAll(this.filters()).subscribe({
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

  onPage(page: number): void {
    this.patch({ page });
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_CATEGORY_FILTERS });
    this.load();
  }

  askDelete(category: Category): void {
    this.pendingDelete.set(category);
  }

  confirmDelete(): void {
    const category = this.pendingDelete();

    if (!category) {
      return;
    }

    this.deleting.set(true);

    this.categories.delete(category.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.toast.show('success', `${category.name} was deleted.`);
        this.afterDelete();
      },
      error: (error: HttpErrorResponse) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);

        // A category holding products cannot be deleted. That is a business
        // rule, and the API words it — show what it said rather than a guess.
        if (error.status === 422) {
          this.toast.show('error', error.error?.message ?? 'That category could not be deleted.');
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

  private patch(change: Partial<CategoryFilters>): void {
    this.filters.update((current) => ({ ...current, ...change }));
    this.load();
  }
}
