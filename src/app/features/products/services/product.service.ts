import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { ApiResponse, Paginated } from '../../../core/models/api-response.model';
import {
  CategoryOption,
  Product,
  ProductFilters,
  ProductImage,
} from '../models/product.model';

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
   * The gallery endpoints. All five are gated by `products.update` — the read
   * included, because the gallery is part of the edit screen and not part of the
   * catalogue — and every one of them answers with the collection as it now
   * stands, so the screen redraws from the response instead of refetching.
   */
  getImages(productId: number): Observable<ProductImage[]> {
    return this.http
      .get<ApiResponse<ProductImage[]>>(this.imagesUrl(productId))
      .pipe(map((response) => response.data));
  }

  addImages(productId: number, files: File[]): Observable<ProductImage[]> {
    const data = new FormData();

    files.forEach((file) => data.append('images[]', file));

    return this.http
      .post<ApiResponse<ProductImage[]>>(this.imagesUrl(productId), data)
      .pipe(map((response) => response.data));
  }

  deleteImage(productId: number, mediaId: number): Observable<ProductImage[]> {
    return this.http
      .delete<ApiResponse<ProductImage[]>>(`${this.imagesUrl(productId)}/${mediaId}`)
      .pipe(map((response) => response.data));
  }

  setPrimaryImage(productId: number, mediaId: number): Observable<ProductImage[]> {
    return this.http
      .patch<ApiResponse<ProductImage[]>>(
        `${this.imagesUrl(productId)}/${mediaId}/primary`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  /** The body key is `media_ids`, and the order of the array is the new order. */
  reorderImages(productId: number, mediaIds: number[]): Observable<ProductImage[]> {
    return this.http
      .patch<ApiResponse<ProductImage[]>>(`${this.imagesUrl(productId)}/reorder`, {
        media_ids: mediaIds,
      })
      .pipe(map((response) => response.data));
  }

  private imagesUrl(productId: number): string {
    return `/api/products/${productId}/images`;
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
