import { Injectable, signal } from '@angular/core';

export type Locale = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly _locale = signal<Locale>('en');

  readonly locale = this._locale.asReadonly();

  setLocale(locale: Locale): void {
    this._locale.set(locale);

    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }
}
