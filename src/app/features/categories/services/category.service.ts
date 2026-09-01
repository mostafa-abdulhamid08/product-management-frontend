import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { ApiResponse, Paginated } from '../../../core/models/api-response.model';
import { Category, CategoryFilters } from '../models/category.model';

export interface CategoryPayload {
  name: string;
  description: string | null;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);

  getAll(filters: CategoryFilters): Observable<Paginated<Category>> {
    let params = new HttpParams().set('page', filters.page);

    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }

    return this.http.get<Paginated<Category>>('/api/categories', { params });
  }

  getById(id: number): Observable<Category> {
    return this.http
      .get<ApiResponse<Category>>(`/api/categories/${id}`)
      .pipe(map((response) => response.data));
  }

  create(payload: CategoryPayload): Observable<Category> {
    return this.http
      .post<ApiResponse<Category>>('/api/categories', payload)
      .pipe(map((response) => response.data));
  }

  /** No image here, so a real PUT with JSON is fine. */
  update(id: number, payload: CategoryPayload): Observable<Category> {
    return this.http
      .put<ApiResponse<Category>>(`/api/categories/${id}`, payload)
      .pipe(map((response) => response.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/categories/${id}`);
  }
}
