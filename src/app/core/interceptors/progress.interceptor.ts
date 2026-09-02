import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

import { ProgressService } from '../services/progress.service';

export const progressInterceptor: HttpInterceptorFn = (req, next) => {
  const progress = inject(ProgressService);

  progress.start();

  return next(req).pipe(finalize(() => progress.done()));
};
