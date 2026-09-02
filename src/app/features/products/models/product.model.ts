import { TranslatedText } from '../../../core/models/translated-text.model';

export interface ProductCategory {
  id: number;
  name: TranslatedText;
}

export interface ProductImage {
  id: number;
  url: string;
  thumb_url: string;
  is_primary: boolean;
  /** The position in the gallery. The API renumbers from 1 on every reorder. */
  order: number;
}

/**
 * The ceiling the API enforces. Mirrored here so the form can refuse a ninth file
 * before spending an upload — the server is still the authority.
 */
export const MAX_PRODUCT_IMAGES = 8;

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
  /**
   * A list row and the dashboard carry only the primary image's thumbnail; the
   * details endpoint carries the whole gallery instead. A page of fifteen products
   * would otherwise ship up to a hundred and twenty image objects to render fifteen
   * thumbnails. Exactly one of these two keys is present on any given response.
   */
  primary_image_url?: string | null;
  images?: ProductImage[];
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
