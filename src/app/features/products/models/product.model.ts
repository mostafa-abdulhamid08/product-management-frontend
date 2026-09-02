import { TranslatedText } from '../../../core/models/translated-text.model';

export interface ProductCategory {
  id: number;
  name: TranslatedText;
}

export interface Product {
  id: number;
  name: TranslatedText;
  /**
   * Absent entirely when neither language has been written — the API drops the
   * key rather than sending a pair of nulls, so this is optional and not just
   * nullable.
   */
  description?: TranslatedText;
  /** A string on purpose — money is never a float. See README. */
  price: string;
  stock: number;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  status_label: string;
  category_id: number;
  category: ProductCategory;
  created_at: string;
  updated_at: string;
}

export type ProductStatus = 'active' | 'inactive';

export interface ProductFilters {
  search: string;
  category_id: number | null;
  status: ProductStatus | null;
  page: number;
}

export interface CategoryOption {
  id: number;
  name: TranslatedText;
}

export const EMPTY_PRODUCT_FILTERS: ProductFilters = {
  search: '',
  category_id: null,
  status: null,
  page: 1,
};

export function hasActiveFilters(filters: ProductFilters): boolean {
  return filters.search.trim() !== '' || filters.category_id !== null || filters.status !== null;
}
