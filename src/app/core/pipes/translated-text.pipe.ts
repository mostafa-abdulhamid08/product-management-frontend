import { inject, Pipe, PipeTransform } from '@angular/core';

import { TranslatedText } from '../models/translated-text.model';
import { LocaleService } from '../services/locale.service';

/**
 * `{{ product.name | tx }}` — the current language's value of a bilingual
 * catalogue field, falling back to the other when this one is empty.
 *
 * Not to be confused with `t`, which looks up a message key from our own files.
 * This one resolves data the API sent in both languages. They sit side by side
 * because they answer the same question about two different sources of text.
 *
 * Impure for the same reason as `t`: the expression never changes, so a pure
 * pipe would never re-run when the locale does. It lives in `core/` for the same
 * reason too — it injects `LocaleService`, and `shared/` may not.
 */
@Pipe({ name: 'tx', pure: false })
export class TranslatedTextPipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(value: TranslatedText | null | undefined): string {
    return this.locale.text(value);
  }
}
