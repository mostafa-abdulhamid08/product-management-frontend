import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { TranslatedTextPipe } from '../../../../core/pipes/translated-text.pipe';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import { Product, ProductImage } from '../../models/product.model';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-product-details',
  imports: [
    DatePipe,
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    PricePipe,
    TranslatePipe,
    TranslatedTextPipe,
  ],
  templateUrl: './product-details.component.html',
})
export class ProductDetailsComponent implements OnInit {
  private readonly products = inject(ProductService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LocaleService);

  /** Bound from the route parameter by withComponentInputBinding(). */
  readonly id = input<string | undefined>(undefined);

  /** A non-numeric id is a bad link, not a request worth making. */
  readonly productId = computed(() => {
    const parsed = Number(this.id());

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  readonly product = signal<Product | null>(null);

  /** In gallery order. The details endpoint sorts it; a list row has none of it. */
  readonly images = computed<ProductImage[]>(() => this.product()?.images ?? []);

  readonly primaryImage = computed<ProductImage | null>(
    () => this.images().find((image) => image.is_primary) ?? this.images()[0] ?? null,
  );

  /** Null means "whichever is primary" — the strip has not been clicked yet. */
  readonly selectedImageId = signal<number | null>(null);

  readonly activeImage = computed<ProductImage | null>(() => {
    const selected = this.selectedImageId();

    return (
      this.images().find((image) => image.id === selected) ?? this.primaryImage()
    );
  });

  readonly activeIndex = computed(() => {
    const active = this.activeImage();

    return active ? this.images().findIndex((image) => image.id === active.id) : -1;
  });

  /**
   * `delta` is -1 for the previous image and 1 for the next. It wraps, so neither
   * arrow ever dead-ends — a gallery of four should not need a disabled state at
   * each end to page around.
   */
  step(delta: number): void {
    const images = this.images();

    if (images.length < 2) {
      return;
    }

    const next = (this.activeIndex() + delta + images.length) % images.length;

    this.selectedImageId.set(images[next].id);
  }
  readonly loading = signal(true);
  readonly missing = signal(false);
  readonly failed = signal(false);
  readonly confirming = signal(false);
  readonly deleting = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.productId();

    if (id === null) {
      this.missing.set(true);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.missing.set(false);
    this.failed.set(false);
    this.selectedImageId.set(null);

    this.products.getById(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.loading.set(false);
      },
      error: (error: { status?: number }) => {
        // 404 is left to the component on purpose — a missing record is not a
        // page error, and the interceptor does not redirect for it.
        this.missing.set(error.status === 404);
        this.failed.set(error.status !== 404);
        this.loading.set(false);
      },
    });
  }

  confirmDelete(): void {
    const product = this.product();

    if (!product) {
      return;
    }

    this.deleting.set(true);

    this.products.delete(product.id).subscribe({
      next: () => {
        this.toast.show(
          'success',
          this.locale.translate('products.deleted', { name: this.locale.text(product.name) }),
        );
        this.router.navigateByUrl('/products');
      },
      error: () => {
        this.deleting.set(false);
        this.confirming.set(false);
      },
    });
  }
}
