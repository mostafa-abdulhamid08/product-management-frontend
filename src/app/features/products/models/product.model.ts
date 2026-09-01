export interface ProductCategory {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
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
  name: string;
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
