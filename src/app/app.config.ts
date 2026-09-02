import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { localeInterceptor } from './core/interceptors/locale.interceptor';
import { progressInterceptor } from './core/interceptors/progress.interceptor';
import { AuthService } from './core/services/auth.service';
import { LocaleService } from './core/services/locale.service';
import { routes } from './app.routes';

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

    // App initializers settle before the router's first navigation, which is
    // what the layout guards depend on: they read permissions synchronously.
    // Messages load here too, so nothing paints with untranslated keys.
    provideAppInitializer(() => {
      const locale = inject(LocaleService);

      return Promise.all([locale.use(locale.preferred()), inject(AuthService).restoreSession()]);
    }),
  ],
};
