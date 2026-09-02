import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { localeInterceptor } from './core/interceptors/locale.interceptor';
import { progressInterceptor } from './core/interceptors/progress.interceptor';
import { AuthService } from './core/services/auth.service';
import { LocaleService } from './core/services/locale.service';
import { routes } from './app.routes';

registerLocaleData(localeAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(
      withInterceptors([
        credentialsInterceptor,
        localeInterceptor,
        progressInterceptor,
        errorInterceptor,
      ]),
    ),
    provideRouter(routes, withComponentInputBinding()),

    // DatePipe formats by LOCALE_ID, which is fixed for the life of the app.
    // That is fine here precisely because switching language reloads: the new
    // choice is already in storage by the time this runs.
    { provide: LOCALE_ID, useFactory: () => inject(LocaleService).preferred() },

    // App initializers settle before the router's first navigation, which is
    // what the layout guards depend on: they read permissions synchronously.
    // Messages load here too, so nothing paints with untranslated keys.
    provideAppInitializer(() => {
      const locale = inject(LocaleService);

      return Promise.all([locale.use(locale.preferred()), inject(AuthService).restoreSession()]);
    }),
  ],
};
