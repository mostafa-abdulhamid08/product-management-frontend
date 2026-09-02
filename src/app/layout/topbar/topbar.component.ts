import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { AuthService } from '../../core/services/auth.service';
import { Locale, LocaleService } from '../../core/services/locale.service';

@Component({
  selector: 'app-topbar',
  imports: [TranslatePipe],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly locales = inject(LocaleService);

  readonly user = this.auth.user;
  readonly locale = this.locales.locale;

  switchLocale(value: string): void {
    const locale = value as Locale;

    if (locale === this.locale()) {
      return;
    }

    // Our own labels re-render from the signal, but everything the API worded —
    // status labels, role display names, validation messages — arrived in the
    // previous language and would sit there until each screen happened to
    // refetch. Reloading is blunt, but it is the only way to get one language on
    // screen at once. The choice is already persisted, so it survives.
    void this.locales.use(locale).then(() => location.reload());
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}
