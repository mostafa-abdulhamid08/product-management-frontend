import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { ApiResponse, Paginated } from '../../../core/models/api-response.model';
import { CategoryOption, Product, ProductFilters } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getAll(filters: ProductFilters): Observable<Paginated<Product>> {
    let params = new HttpParams().set('page', filters.page);

    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.category_id !== null) {
      params = params.set('category_id', filters.category_id);
    }

    if (filters.status !== null) {
      params = params.set('status', filters.status);
    }

    return this.http.get<Paginated<Product>>('/api/products', { params });
  }

  getById(id: number): Observable<Product> {
    return this.http
      .get<ApiResponse<Product>>(`/api/products/${id}`)
      .pipe(map((response) => response.data));
  }

  create(data: FormData): Observable<Product> {
    return this.http
      .post<ApiResponse<Product>>('/api/products', data)
      .pipe(map((response) => response.data));
  }

  /**
   * POST with `_method=PUT`. PHP does not parse multipart bodies on a real PUT,
   * and the image makes this multipart.
   */
  update(id: number, data: FormData): Observable<Product> {
    data.append('_method', 'PUT');

    return this.http
      .post<ApiResponse<Product>>(`/api/products/${id}`, data)
      .pipe(map((response) => response.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/products/${id}`);
  }

  /**
   * The options endpoint, not `GET /api/categories`. It is OR-gated, so it works
   * for someone who can create a product but cannot view the category screens.
   */
  categoryOptions(): Observable<CategoryOption[]> {
    return this.http
      .get<ApiResponse<CategoryOption[]>>('/api/categories/options')
      .pipe(map((response) => response.data));
  }
}
