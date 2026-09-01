export interface Role {
  id: number;
  /** The key. Compared, never printed, never translated. */
  name: string;
  /** The label. Printed, never compared. */
  display_name: string;
  description: string | null;
  /** Flat `resource.action` strings, exactly as the API stores them. */
  permissions: string[];
  users_count: number;
  created_at: string;
}

/** `{ products: ['view', 'create', 'update', 'delete'], ... }` — the matrix shape. */
export type PermissionMatrix = Record<string, string[]>;

/** The one role the API protects from edit and delete. */
export const PROTECTED_ROLE = 'super-admin';

export function permissionKey(resource: string, action: string): string {
  return `${resource}.${action}`;
}

/** Distinct actions across the matrix, in the order the first resource lists them. */
export function matrixActions(matrix: PermissionMatrix): string[] {
  const seen = new Set<string>();

  Object.values(matrix).forEach((actions) => actions.forEach((action) => seen.add(action)));

  return [...seen];
}
