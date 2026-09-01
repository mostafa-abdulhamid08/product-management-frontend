import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Holding either one puts a user in the admin shell. Declared once, used twice. */
export const ADMIN_PERMISSIONS = ['users.view', 'roles.view'];

/**
 * Returns a bare `false`, never a UrlTree. Falling through is the mechanism:
 * it is what lets CatalogLayout pick up the user this route declined. A
 * redirect here would make the catalog shell unreachable.
 */
export const adminGuard: CanMatchFn = () => inject(AuthService).hasAny(...ADMIN_PERMISSIONS);

/**
 * Gates the catalog layout's 403 catch-all so it only catches catalog users.
 *
 * Without this the catch-all swallows admins too — they are authenticated, so
 * they match `catalogGuard` — and a super admin who typos a URL is shown "not
 * yours" about a page that is nobody's, in the wrong shell. An admin has every
 * route already, so an unmatched path is genuinely absent: let it fall through
 * to the outer `**` and report 404.
 */
export const catalogFallbackGuard: CanMatchFn = () =>
  !inject(AuthService).hasAny(...ADMIN_PERMISSIONS);
