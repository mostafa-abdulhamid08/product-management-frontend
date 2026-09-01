import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { CSRF_RETRIED, SKIP_AUTH_REDIRECT, SKIP_FORBIDDEN_REDIRECT } from '../http-context';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const http = inject(HttpClient);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 419 && !req.context.get(CSRF_RETRIED)) {
        // Stale CSRF token, not a lost session. Angular's XSRF interceptor sits
        // upstream and will not run again on the replay, so the refreshed token
        // has to be attached by hand.
        return http.get('/sanctum/csrf-cookie').pipe(
          switchMap(() => {
            const token = readCookie('XSRF-TOKEN');

            return next(
              req.clone({
                context: req.context.set(CSRF_RETRIED, true),
                setHeaders: token ? { 'X-XSRF-TOKEN': token } : {},
              }),
            );
          }),
        );
      }

      if (error.status === 401 && !req.context.get(SKIP_AUTH_REDIRECT)) {
        auth.clear();
        router.navigateByUrl('/login');
      }

      if (error.status === 403 && !req.context.get(SKIP_FORBIDDEN_REDIRECT)) {
        router.navigateByUrl('/403');
      }

      if (error.status >= 500) {
        toast.show('error', 'Something went wrong. Please try again.');
      }

      return throwError(() => error);
    }),
  );
};
