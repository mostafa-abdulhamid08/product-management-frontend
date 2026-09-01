import { inject, isDevMode } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * The last shell, so it redirects instead of falling through — a `false` here
 * would drop the user on the outer `**` and report 404 at a signed-out session.
 */
export const catalogGuard: CanMatchFn = (_route: Route, segments: UrlSegment[]) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  warnOnAdminFallthrough(auth, segments);

  return auth.isAuthenticated() || router.createUrlTree(['/login']);
};

/**
 * This guard only runs after the admin layout declined the URL. For a user who
 * *does* hold admin permissions that means the admin layout matched and then
 * failed to match a child — a route missing from `adminChildren`, not a
 * permission problem. Angular backtracks silently and the catalog shell's
 * catch-all renders 403, which reads as "not yours" for a route that is simply
 * not declared. Say so out loud while developing.
 */
function warnOnAdminFallthrough(auth: AuthService, segments: UrlSegment[]): void {
  if (!isDevMode() || !auth.hasAny('users.view', 'roles.view')) {
    return;
  }

  const path = `/${segments.map((segment) => segment.path).join('/')}`;

  console.warn(
    `[routes] admin route not found: ${path} — falling through to the catalog shell, ` +
      `which will render 403. This is a missing child route in app.routes.ts, not a ` +
      `missing permission.`,
  );
}
