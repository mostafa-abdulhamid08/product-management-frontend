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
import { Category } from '../../models/category.model';
import { CategoryPayload, CategoryService } from '../../services/category.service';

/** An emptied textarea means "no description", which the API spells as null. */
function blankToNull(value: string): string | null {
  return value.trim() === '' ? null : value;
}

@Component({
  selector: 'app-category-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    TranslatePipe,
  ],
  templateUrl: './category-form.component.html',
})
export class CategoryFormComponent implements OnInit {
  private readonly categories = inject(CategoryService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LocaleService);

  readonly id = input<string | undefined>(undefined);

  readonly form = inject(FormBuilder).nonNullable.group({
    name_en: ['', [Validators.required, Validators.maxLength(255)]],
    name_ar: ['', [Validators.required, Validators.maxLength(255)]],
    description_en: [''],
    description_ar: [''],
  });

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly missing = signal(false);
  readonly formError = signal<string | null>(null);

  readonly categoryId = computed(() => {
    const parsed = Number(this.id());

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  readonly isEdit = computed(() => this.categoryId() !== null);
  readonly headingKey = computed(() =>
    this.isEdit() ? 'categories.editTitle' : 'categories.addTitle',
  );

  ngOnInit(): void {
    if (!this.isEdit()) {
      return;
    }

    this.loading.set(true);

    this.categories.getById(this.categoryId()!).subscribe({
      next: (category) => {
        this.fill(category);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.missing.set(error.status === 404);
        this.loading.set(false);
      },
    });
  }

  private fill(category: Category): void {
    this.form.patchValue({
      name_en: category.name.en ?? '',
      name_ar: category.name.ar ?? '',
      description_en: category.description?.en ?? '',
      description_ar: category.description?.ar ?? '',
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
    const payload: CategoryPayload = {
      name_en: value.name_en,
      name_ar: value.name_ar,
      description_en: blankToNull(value.description_en),
      description_ar: blankToNull(value.description_ar),
    };

    const request = this.isEdit()
      ? this.categories.update(this.categoryId()!, payload)
      : this.categories.create(payload);

    request.subscribe({
      next: (category) => {
        this.toast.show(
          'success',
          this.locale.translate('categories.saved', {
            name: this.locale.text(category.name),
          }),
        );
        this.router.navigateByUrl('/categories');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.applyServerError(error);
      },
    });
  }

  private applyServerError(error: HttpErrorResponse): void {
    if (error.status !== 422) {
      this.formError.set(this.locale.translate('categories.saveFailed'));

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
      this.formError.set(body?.message ?? this.locale.translate('categories.saveFailed'));
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
