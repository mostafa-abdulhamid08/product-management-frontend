import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Returns a bare `false`, never a UrlTree. Falling through is the mechanism:
 * it is what lets CatalogLayout pick up the user this route declined. A
 * redirect here would make the catalog shell unreachable.
 */
export const adminGuard: CanMatchFn = () =>
  inject(AuthService).hasAny('users.view', 'roles.view');
