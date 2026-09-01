export interface NavItem {
  label: string;
  route: string;
  icon: 'home' | 'box' | 'tag' | 'users' | 'shield';
  permission: string | null;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: 'home', permission: null },
  { label: 'Products', route: '/products', icon: 'box', permission: 'products.view' },
  { label: 'Categories', route: '/categories', icon: 'tag', permission: 'categories.view' },
  { label: 'Users', route: '/users', icon: 'users', permission: 'users.view', adminOnly: true },
  { label: 'Roles', route: '/roles', icon: 'shield', permission: 'roles.view', adminOnly: true },
];

export const CATALOG_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.adminOnly);
