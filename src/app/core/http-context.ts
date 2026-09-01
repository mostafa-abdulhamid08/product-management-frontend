import { HttpContextToken } from '@angular/common/http';

/** The /me bootstrap expects a 401 when there is no session. It is not a logout. */
export const SKIP_AUTH_REDIRECT = new HttpContextToken(() => false);

/** On login a 403 means the account is deactivated, not an unauthorised route. */
export const SKIP_FORBIDDEN_REDIRECT = new HttpContextToken(() => false);

/** Set once a request has been replayed after a 419, so it cannot loop. */
export const CSRF_RETRIED = new HttpContextToken(() => false);
