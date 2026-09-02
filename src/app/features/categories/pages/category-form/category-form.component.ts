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
import { CategoryService } from '../../services/category.service';

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
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
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
      name: this.locale.text(category.name),
      description: this.locale.text(category.description),
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

    Object.entries(errors).forEach(([field, messages]) => {
      this.form.get(field)?.setErrors({ server: messages[0] });
    });

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
