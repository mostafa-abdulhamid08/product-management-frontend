import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { TranslatedTextPipe } from '../../../../core/pipes/translated-text.pipe';
import { ValidationErrorBody } from '../../../../core/models/api-response.model';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CategoryOption, Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];

@Component({
  selector: 'app-product-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    TranslatePipe,
    TranslatedTextPipe,
  ],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  private readonly products = inject(ProductService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LocaleService);

  /**
   * Present on the edit route only. One component serves both, so this is
   * absent on /products/create — where component input binding sets it to
   * `undefined`, not to the declared default.
   */
  readonly id = input<string | undefined>(undefined);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    price: ['', [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    category_id: ['', [Validators.required]],
    is_active: [true],
  });

  readonly categories = signal<CategoryOption[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly missing = signal(false);
  readonly formError = signal<string | null>(null);

  readonly imageFile = signal<File | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly existingImage = signal<string | null>(null);
  readonly imageError = signal<string | null>(null);

  /** The newly picked file wins; otherwise show whatever the product already has. */
  readonly previewSrc = computed(() => this.imagePreview() ?? this.existingImage());

  /**
   * Edit mode is decided by a usable numeric id, never by the input merely
   * being set. `/products/create` binds `id` as undefined and a malformed
   * `/products/abc/edit` binds a string that is not a number; both must read
   * as "no product to load" rather than sending `products/NaN` to the API.
   */
  readonly productId = computed(() => {
    const parsed = Number(this.id());

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  readonly isEdit = computed(() => this.productId() !== null);
  readonly headingKey = computed(() =>
    this.isEdit() ? 'products.editTitle' : 'products.addTitle',
  );

  ngOnInit(): void {
    this.products.categoryOptions().subscribe({
      next: (options) => this.categories.set(options),
      error: () => this.categories.set([]),
    });

    if (this.isEdit()) {
      this.loadProduct();
    }
  }

  private loadProduct(): void {
    this.loading.set(true);

    this.products.getById(this.productId()!).subscribe({
      next: (product) => {
        this.fill(product);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.missing.set(error.status === 404);
        this.loading.set(false);
      },
    });
  }

  private fill(product: Product): void {
    this.form.patchValue({
      name: this.locale.text(product.name),
      description: this.locale.text(product.description),
      price: product.price,
      stock: product.stock,
      category_id: String(product.category_id),
      is_active: product.is_active,
    });

    this.existingImage.set(product.image_url);
  }

  onImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.imageError.set(null);

    if (!file) {
      this.clearImage();

      return;
    }

    // The same two rules the backend enforces, so the user hears about it
    // before spending an upload. The server is still the authority.
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      this.imageError.set(this.locale.translate('products.imageType'));
      input.value = '';

      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set(this.locale.translate('products.imageTooLarge'));
      input.value = '';

      return;
    }

    this.revokePreview();
    this.imageFile.set(file);
    this.imagePreview.set(URL.createObjectURL(file));
  }

  clearImage(): void {
    this.revokePreview();
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.imageError.set(null);
  }

  private revokePreview(): void {
    const preview = this.imagePreview();

    if (preview) {
      URL.revokeObjectURL(preview);
    }
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

    const request = this.isEdit()
      ? this.products.update(this.productId()!, this.payload())
      : this.products.create(this.payload());

    request.subscribe({
      next: (product) => {
        this.toast.show(
          'success',
          this.locale.translate('products.saved', { name: this.locale.text(product.name) }),
        );
        this.router.navigateByUrl(`/products/${product.id}`);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.applyServerError(error);
      },
    });
  }

  private payload(): FormData {
    const value = this.form.getRawValue();
    const data = new FormData();

    data.append('name', value.name);
    data.append('description', value.description ?? '');
    data.append('price', value.price);
    data.append('stock', String(value.stock));
    data.append('category_id', value.category_id);
    data.append('is_active', value.is_active ? '1' : '0');

    const image = this.imageFile();

    if (image) {
      data.append('image', image);
    }

    return data;
  }

  private applyServerError(error: HttpErrorResponse): void {
    if (error.status !== 422) {
      this.formError.set(this.locale.translate('products.saveFailed'));

      return;
    }

    const body = error.error as ValidationErrorBody;
    const errors = body?.errors ?? {};

    Object.entries(errors).forEach(([field, messages]) => {
      if (field === 'image') {
        this.imageError.set(messages[0]);

        return;
      }

      this.form.get(field)?.setErrors({ server: messages[0] });
    });

    if (Object.keys(errors).length === 0) {
      this.formError.set(body?.message ?? this.locale.translate('products.saveFailed'));
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
      return this.locale.translate('common.requiredField');
    }

    return control.hasError('min') ? this.locale.translate('products.minZero') : null;
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
