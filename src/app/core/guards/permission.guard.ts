import { inject } from '@angular/core';
import { CanMatchFn, Route, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Reads the permission from the route's own `data`, so the string stays on the
 * route and never spreads into component logic. Redirects rather than returning
 * `false`: a bare `false` would fall through to the outer `**` and report 404 at
 * a route the user simply cannot open.
 */
export const permissionGuard: CanMatchFn = (route: Route) => {
  const required = route.data?.['permission'] as string | undefined;

  if (!required) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.hasPermission(required) || router.createUrlTree(['/403']);
};
