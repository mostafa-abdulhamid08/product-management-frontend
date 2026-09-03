import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { TranslatedTextPipe } from '../../../../core/pipes/translated-text.pipe';
import { ValidationErrorBody } from '../../../../core/models/api-response.model';
import { LocaleService } from '../../../../core/services/locale.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  CategoryOption,
  MAX_PRODUCT_IMAGES,
  Product,
  ProductImage,
} from '../../models/product.model';
import { ProductService } from '../../services/product.service';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];

/** A file chosen but not yet uploaded, with the blob URL its preview renders from. */
interface PickedImage {
  file: File;
  url: string;
}

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
export class ProductFormComponent implements OnInit, OnDestroy {
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
    name_en: ['', [Validators.required, Validators.maxLength(255)]],
    name_ar: ['', [Validators.required, Validators.maxLength(255)]],
    description_en: [''],
    description_ar: [''],
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

  readonly maxImages = MAX_PRODUCT_IMAGES;

  /** Create only: files chosen but not yet uploaded. They go with the first save. */
  readonly pickedImages = signal<PickedImage[]>([]);
  readonly imageError = signal<string | null>(null);

  /**
   * Edit only: the product's real gallery. Every change here is its own request
   * that lands before the form is saved, because the images are not form fields —
   * an upload cannot wait for a Save the user may never press.
   */
  readonly gallery = signal<ProductImage[]>([]);
  readonly galleryBusy = signal(false);

  readonly galleryRoom = computed(() => this.maxImages - this.gallery().length);

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
      name_en: product.name.en ?? '',
      name_ar: product.name.ar ?? '',
      description_en: product.description?.en ?? '',
      description_ar: product.description?.ar ?? '',
      price: product.price,
      stock: product.stock,
      category_id: String(product.category_id),
      is_active: product.is_active,
    });

    this.gallery.set(product.images ?? []);
  }

  addToGallery(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);

    input.value = '';

    if (chosen.length === 0) {
      return;
    }

    if (chosen.length > this.galleryRoom()) {
      this.toast.show(
        'error',
        this.locale.translate('products.tooManyImages', { max: this.maxImages }),
      );

      return;
    }

    const rejection = chosen.map((file) => this.reject(file)).find((key) => key !== null);

    if (rejection) {
      this.toast.show('error', this.locale.translate(rejection));

      return;
    }

    this.runOnGallery(
      this.products.addImages(this.productId()!, chosen),
      'products.imagesAdded',
    );
  }

  deleteFromGallery(image: ProductImage): void {
    this.runOnGallery(
      this.products.deleteImage(this.productId()!, image.id),
      'products.imageDeleted',
    );
  }

  makePrimary(image: ProductImage): void {
    this.runOnGallery(
      this.products.setPrimaryImage(this.productId()!, image.id),
      'products.primarySet',
    );
  }

  /** `delta` is -1 for earlier and 1 for later. The whole order is sent back. */
  moveImage(index: number, delta: number): void {
    const order = this.gallery().map((image) => image.id);
    const target = index + delta;

    if (target < 0 || target >= order.length) {
      return;
    }

    [order[index], order[target]] = [order[target], order[index]];

    this.runOnGallery(
      this.products.reorderImages(this.productId()!, order),
      'products.imagesReordered',
    );
  }

  /**
   * One in flight at a time, and the response is the new gallery — the API sends
   * the whole collection back after every write, so nothing needs refetching.
   *
   * A refusal here is one of the two business rules: no ninth image, and a product
   * must keep at least one. The API has already worded and translated both, so show
   * what it said. The fallback covers a body that could not be read at all.
   */
  private runOnGallery(request: Observable<ProductImage[]>, successKey: string): void {
    if (this.galleryBusy()) {
      return;
    }

    this.galleryBusy.set(true);

    request.subscribe({
      next: (images) => {
        this.gallery.set(images);
        this.galleryBusy.set(false);
        this.toast.show('success', this.locale.translate(successKey));
      },
      error: (error: HttpErrorResponse) => {
        this.galleryBusy.set(false);
        this.toast.show(
          'error',
          error.error?.message ?? this.locale.translate('products.imageActionFailed'),
        );
      },
    });
  }

  /**
   * Adds to the selection rather than replacing it, so several picks build one
   * set. The first file in the finished set becomes the primary image — that is
   * the API's rule, not ours, and the badge on the first preview says so.
   */
  onImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);

    // Cleared so that re-picking the very same file still fires a change event.
    input.value = '';
    this.imageError.set(null);

    if (chosen.length === 0) {
      return;
    }

    if (chosen.length > this.maxImages - this.pickedImages().length) {
      this.imageError.set(
        this.locale.translate('products.tooManyImages', { max: this.maxImages }),
      );

      return;
    }

    // The same two rules the backend enforces, so the user hears about it before
    // spending an upload. The server is still the authority. Every file is checked
    // before any blob URL is made, so a rejected batch leaks nothing.
    const rejection = chosen.map((file) => this.reject(file)).find((key) => key !== null);

    if (rejection) {
      this.imageError.set(this.locale.translate(rejection));

      return;
    }

    const picked = chosen.map((file) => ({ file, url: URL.createObjectURL(file) }));

    this.pickedImages.update((current) => [...current, ...picked]);
  }

  private reject(file: File): string | null {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return 'products.imageType';
    }

    return file.size > MAX_IMAGE_BYTES ? 'products.imageTooLarge' : null;
  }

  removePicked(index: number): void {
    this.imageError.set(null);
    this.pickedImages.update((current) => {
      const removed = current[index];

      if (removed) {
        URL.revokeObjectURL(removed.url);
      }

      return current.filter((_, position) => position !== index);
    });
  }

  ngOnDestroy(): void {
    this.pickedImages().forEach(({ url }) => URL.revokeObjectURL(url));
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

    data.append('name_en', value.name_en);
    data.append('name_ar', value.name_ar);
    data.append('description_en', value.description_en);
    data.append('description_ar', value.description_ar);
    data.append('price', value.price);
    data.append('stock', String(value.stock));
    data.append('category_id', value.category_id);
    data.append('is_active', value.is_active ? '1' : '0');

    // Create only. `images` on an update replaces the whole collection and deletes
    // the files it replaces, so the edit screen manages images through their own
    // endpoints instead and this form never sends the key there.
    if (!this.isEdit()) {
      this.pickedImages().forEach(({ file }) => data.append('images[]', file));
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

    // The four translated controls are named after the columns the API
    // validates — name_en, name_ar, description_en, description_ar — so each
    // message lands on its own input by name alone. A key with no control of
    // that name would otherwise vanish silently, so it goes to the banner.
    const unmatched: string[] = [];

    Object.entries(errors).forEach(([field, messages]) => {
      if (field === 'images' || field.startsWith('images.')) {
        this.imageError.set(messages[0]);

        return;
      }

      const control = this.form.get(field);

      if (control) {
        control.setErrors({ server: messages[0] });

        return;
      }

      unmatched.push(messages[0]);
    });

    if (unmatched.length > 0) {
      this.formError.set(unmatched.join(' '));

      return;
    }

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

    if (control.hasError('maxlength')) {
      return this.locale.translate('common.maxLength');
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
