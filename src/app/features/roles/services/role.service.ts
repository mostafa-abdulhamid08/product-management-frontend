import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { ApiResponse, Paginated } from '../../../core/models/api-response.model';
import { PermissionMatrix, Role } from '../models/role.model';

export interface RolePayload {
  name: string;
  description: string | null;
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);

  getAll(page: number): Observable<Paginated<Role>> {
    return this.http.get<Paginated<Role>>('/api/roles', {
      params: new HttpParams().set('page', page),
    });
  }

  getById(id: number): Observable<Role> {
    return this.http.get<ApiResponse<Role>>(`/api/roles/${id}`).pipe(map((r) => r.data));
  }

  create(payload: RolePayload): Observable<Role> {
    return this.http.post<ApiResponse<Role>>('/api/roles', payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: RolePayload): Observable<Role> {
    return this.http.put<ApiResponse<Role>>(`/api/roles/${id}`, payload).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/roles/${id}`);
  }

  /**
   * All sixteen, already grouped by resource — the shape the matrix renders.
   * OR-gated, so it reaches someone who can create roles but not view them.
   */
  permissionMatrix(): Observable<PermissionMatrix> {
    return this.http
      .get<ApiResponse<PermissionMatrix>>('/api/permissions')
      .pipe(map((r) => r.data));
  }
}
