import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { ApiResponse } from '../../../core/models/api-response.model';
import { DashboardStats } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  get(): Observable<DashboardStats> {
    return this.http
      .get<ApiResponse<DashboardStats>>('/api/dashboard')
      .pipe(map((response) => response.data));
  }
}
