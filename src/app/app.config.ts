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
import { AuthService } from './core/services/auth.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(
      withInterceptors([credentialsInterceptor, localeInterceptor, errorInterceptor]),
    ),
    provideRouter(routes, withComponentInputBinding()),

    // App initializers settle before the router's first navigation, which is
    // what the layout guards depend on: they read permissions synchronously.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
