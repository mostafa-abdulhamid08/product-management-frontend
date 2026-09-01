import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import {
  CategoryOption,
  EMPTY_PRODUCT_FILTERS,
  hasActiveFilters,
  Product,
  ProductFilters,
  ProductStatus,
} from '../../models/product.model';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-product-list',
  imports: [
    FormsModule,
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    DataTableComponent,
    StatusBadgeComponent,
    ConfirmDialogComponent,
    PricePipe,
  ],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  private readonly products = inject(ProductService);
  private readonly toast = inject(ToastService);

  private readonly searchInput = new Subject<string>();

  readonly filters = signal<ProductFilters>({ ...EMPTY_PRODUCT_FILTERS });
  readonly rows = signal<Product[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly categories = signal<CategoryOption[]>([]);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly pendingDelete = signal<Product | null>(null);
  readonly deleting = signal(false);

  readonly filtered = computed(() => hasActiveFilters(this.filters()));

  readonly columns: DataTableColumn[] = [
    { label: 'Image', width: 'w-16' },
    { label: 'Product' },
    { label: 'Category' },
    { label: 'Price', align: 'end' },
    { label: 'Stock', align: 'end' },
    { label: 'Status' },
    { label: 'Actions', align: 'end', width: 'w-28' },
  ];

  constructor() {
    // Debouncing keystrokes is a stream. The result of it still lands in a signal.
    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.patch({ search, page: 1 }));
  }

  ngOnInit(): void {
    this.load();
    this.products.categoryOptions().subscribe({
      next: (options) => this.categories.set(options),
      // A missing dropdown must not take the list down with it.
      error: () => this.categories.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.products.getAll(this.filters()).subscribe({
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

  onCategory(value: string): void {
    this.patch({ category_id: value === '' ? null : Number(value), page: 1 });
  }

  onStatus(value: string): void {
    this.patch({ status: value === '' ? null : (value as ProductStatus), page: 1 });
  }

  onPage(page: number): void {
    this.patch({ page });
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_PRODUCT_FILTERS });
    this.load();
  }

  askDelete(product: Product): void {
    this.pendingDelete.set(product);
  }

  confirmDelete(): void {
    const product = this.pendingDelete();

    if (!product) {
      return;
    }

    this.deleting.set(true);

    this.products.delete(product.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.toast.show('success', `${product.name} was deleted.`);
        this.afterDelete();
      },
      error: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
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

  private patch(change: Partial<ProductFilters>): void {
    this.filters.update((current) => ({ ...current, ...change }));
    this.load();
  }
}
