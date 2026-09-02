import { inject, Pipe, PipeTransform } from '@angular/core';

import { LocaleService } from '../services/locale.service';

/**
 * `{{ 'products.title' | t }}`, or with placeholders:
 * `{{ 'products.deleteMessage' | t: { name: product.name } }}`.
 *
 * Impure on purpose. The key never changes, so a pure pipe would never re-run
 * when the locale does — and switching language has to re-render every label.
 * The lookup is a walk down a plain object, which is cheap enough to run per
 * change detection at this size.
 *
 * It lives in `core/` rather than `shared/` for the same reason as
 * `hasPermission`: it injects a core service.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.locale.translate(key, params);
  }
}
