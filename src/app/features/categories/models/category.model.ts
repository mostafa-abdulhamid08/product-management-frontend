import { TranslatedText } from '../../../core/models/translated-text.model';

export interface Category {
  id: number;
  name: TranslatedText;
  /** Absent when neither language has been written. */
  description?: TranslatedText;
  /** Derived with withCount on the backend; never stored. */
  products_count: number;
  created_at: string;
}

export interface CategoryFilters {
  search: string;
  page: number;
}

export const EMPTY_CATEGORY_FILTERS: CategoryFilters = {
  search: '',
  page: 1,
};

export function hasActiveCategoryFilters(filters: CategoryFilters): boolean {
  return filters.search.trim() !== '';
}
