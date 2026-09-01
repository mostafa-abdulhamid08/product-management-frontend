import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { LocaleService } from '../services/locale.service';

export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  const locale = inject(LocaleService).locale();

  return next(req.clone({ setHeaders: { 'Accept-Language': locale } }));
};
