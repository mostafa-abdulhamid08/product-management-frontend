import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { ApiResponse, Paginated } from '../../../core/models/api-response.model';
import { RoleOption, UserFilters, UserRecord } from '../models/user-record.model';

export interface UserPayload {
  name: string;
  email: string;
  role: string;
  password?: string;
  password_confirmation?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getAll(filters: UserFilters): Observable<Paginated<UserRecord>> {
    let params = new HttpParams().set('page', filters.page);

    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.role !== null) {
      params = params.set('role', filters.role);
    }

    if (filters.status !== null) {
      params = params.set('status', filters.status);
    }

    return this.http.get<Paginated<UserRecord>>('/api/users', { params });
  }

  getById(id: number): Observable<UserRecord> {
    return this.http
      .get<ApiResponse<UserRecord>>(`/api/users/${id}`)
      .pipe(map((response) => response.data));
  }

  create(payload: UserPayload): Observable<UserRecord> {
    return this.http
      .post<ApiResponse<UserRecord>>('/api/users', payload)
      .pipe(map((response) => response.data));
  }

  update(id: number, payload: UserPayload): Observable<UserRecord> {
    return this.http
      .put<ApiResponse<UserRecord>>(`/api/users/${id}`, payload)
      .pipe(map((response) => response.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }

  /** Fired straight from the table row, which is why it is not part of update. */
  toggleStatus(id: number): Observable<UserRecord> {
    return this.http
      .patch<ApiResponse<UserRecord>>(`/api/users/${id}/toggle-status`, {})
      .pipe(map((response) => response.data));
  }

  /** OR-gated options endpoint, so it works for someone who can only create users. */
  roleOptions(): Observable<RoleOption[]> {
    return this.http
      .get<ApiResponse<RoleOption[]>>('/api/roles/options')
      .pipe(map((response) => response.data));
  }
}
