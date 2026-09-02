import { TranslatedText } from '../../../core/models/translated-text.model';

/**
 * Only the fields the dashboard renders. Deliberately not the Products feature's
 * `Product` — features never import from each other, and this screen needs a
 * fraction of it.
 */
export interface RecentProduct {
  id: number;
  name: TranslatedText;
  price: string;
  stock: number;
  is_active: boolean;
  status_label: string;
  category: { id: number; name: TranslatedText };
  created_at: string;
}

/**
 * The counts the caller is allowed to see. A count the user cannot view is
 * absent from the response, not zeroed — so this is an open record, and the
 * screen iterates whatever came back.
 */
export interface DashboardStats {
  recent_products?: RecentProduct[];
  [resource: string]: number | RecentProduct[] | undefined;
}

export interface StatCard {
  key: string;
  /** A message key. An unknown resource falls back to its own name. */
  labelKey: string;
  fallback: string;
  value: number;
}

const KNOWN = ['products', 'categories', 'users', 'roles'];

/** Unknown keys still render, so a new backend resource needs no change here. */
export function toCards(stats: DashboardStats): StatCard[] {
  return Object.entries(stats)
    .filter(([key, value]) => key !== 'recent_products' && typeof value === 'number')
    .map(([key, value]) => ({
      key,
      labelKey: KNOWN.includes(key) ? `dashboard.cards.${key}` : '',
      fallback: key.charAt(0).toUpperCase() + key.slice(1),
      value: value as number,
    }));
}
