import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * The last shell, so it redirects instead of falling through — a `false` here
 * would drop the user on the outer `**` and report 404 at a signed-out session.
 */
export const catalogGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() || router.createUrlTree(['/login']);
};
