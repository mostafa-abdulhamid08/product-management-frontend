/**
 * A user as the Users screens see it. Separate from `core/models/user.model.ts`,
 * which is the signed-in user and carries a permission list this one does not.
 */
export interface UserRecord {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  status_label: string;
  /** The role key — compared, never printed. */
  role: string;
  /** The translated label — printed, never compared. */
  role_display_name: string;
  created_at: string;
}

export interface RoleOption {
  id: number;
  name: string;
  display_name: string;
}

export type UserStatus = 'active' | 'inactive';

export interface UserFilters {
  search: string;
  role: string | null;
  status: UserStatus | null;
  page: number;
}

export const EMPTY_USER_FILTERS: UserFilters = {
  search: '',
  role: null,
  status: null,
  page: 1,
};

export function hasActiveUserFilters(filters: UserFilters): boolean {
  return filters.search.trim() !== '' || filters.role !== null || filters.status !== null;
}
