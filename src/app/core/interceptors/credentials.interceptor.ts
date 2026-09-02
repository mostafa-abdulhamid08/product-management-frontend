import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/** Only API traffic gets the base URL and the session cookie. */
const API_PREFIXES = ['/api', '/sanctum'];

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiCall = API_PREFIXES.some((prefix) => req.url.startsWith(prefix));

  if (!isApiCall) {
    // Local assets such as /i18n/en.json. Prefixing these would send them to
    // the Laravel host, where they do not exist.
    return next(req);
  }

  return next(req.clone({ url: `${environment.apiUrl}${req.url}`, withCredentials: true }));
};
