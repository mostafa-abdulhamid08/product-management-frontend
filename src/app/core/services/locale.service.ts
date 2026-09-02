import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of, tap } from 'rxjs';

export type Locale = 'en' | 'ar';

export const LOCALES: Locale[] = ['en', 'ar'];

type Messages = Record<string, unknown>;

const STORAGE_KEY = 'locale';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly http = inject(HttpClient);

  private readonly _locale = signal<Locale>('en');
  private readonly _messages = signal<Messages>({});

  readonly locale = this._locale.asReadonly();
  readonly isRtl = computed(() => this._locale() === 'ar');

  /**
   * The stored choice, if there is one. This is a display preference, not auth
   * state, so browser storage is fine for it — and it can come back empty or
   * throw in a private window, hence the guard.
   */
  preferred(): Locale {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      return LOCALES.includes(stored as Locale) ? (stored as Locale) : 'en';
    } catch {
      return 'en';
    }
  }

  use(locale: Locale): Promise<void> {
    return firstValueFrom(
      this.http.get<Messages>(`/i18n/${locale}.json`).pipe(
        tap((messages) => {
          this._messages.set(messages);
          this._locale.set(locale);
          this.applyToDocument(locale);
          this.remember(locale);
        }),
        // A missing message file must not stop the app booting. Keys then
        // render as themselves, which is visible without being fatal.
        catchError(() => {
          this._locale.set(locale);
          this.applyToDocument(locale);

          return of({});
        }),
      ),
    ).then(() => undefined);
  }

  /**
   * Looks up a dotted key and fills `{placeholders}`. A missing key returns the
   * key itself rather than an empty string, so a gap is obvious on screen.
   */
  translate(key: string, params?: Record<string, string | number>): string {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Messages)[part] : undefined,
        this._messages(),
      );

    if (typeof value !== 'string') {
      return key;
    }

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce(
      (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
      value,
    );
  }

  private applyToDocument(locale: Locale): void {
    const root = document.documentElement;

    root.lang = locale;
    root.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }

  private remember(locale: Locale): void {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Private windows and blocked site data. The choice just will not persist.
    }
  }
}
