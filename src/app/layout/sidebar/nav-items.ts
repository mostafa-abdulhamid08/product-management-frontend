export interface NavItem {
  /** A message key, not a label — the sidebar translates it. */
  labelKey: string;
  route: string;
  icon: 'home' | 'box' | 'tag' | 'users' | 'shield';
  permission: string | null;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard', route: '/dashboard', icon: 'home', permission: null },
  { labelKey: 'nav.products', route: '/products', icon: 'box', permission: 'products.view' },
  {
    labelKey: 'nav.categories',
    route: '/categories',
    icon: 'tag',
    permission: 'categories.view',
  },
  {
    labelKey: 'nav.users',
    route: '/users',
    icon: 'users',
    permission: 'users.view',
    adminOnly: true,
  },
  {
    labelKey: 'nav.roles',
    route: '/roles',
    icon: 'shield',
    permission: 'roles.view',
    adminOnly: true,
  },
];

export const CATALOG_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.adminOnly);
