export interface ApiResponse<T> {
  data: T;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ValidationErrorBody {
  message: string;
  errors: Record<string, string[]>;
}
