import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url.startsWith('http') ? req.url : `${environment.apiUrl}${req.url}`;

  return next(req.clone({ url, withCredentials: true }));
};
