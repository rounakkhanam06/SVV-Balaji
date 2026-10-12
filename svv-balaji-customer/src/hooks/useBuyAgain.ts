import { useQuery } from '@tanstack/react-query';
import { checkoutApi } from '../api/checkout';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { toShelfProduct, type ShelfProduct } from './useCatalogue';

export type BuyAgainItem = ShelfProduct & { lastOrderedAt: string; lastQuantity: number; timesOrdered: number };

/**
 * The signed-in shopper's own past purchases for the home "Buy Again" row.
 * Nothing for a guest. Keyed under ['storefront', 'orders'] so anything that
 * refreshes the order list after a purchase refreshes this too.
 */
export function useBuyAgain() {
  const { isLoggedIn, role } = useCustomerAuth();
  const query = useQuery({
    queryKey: ['storefront', 'orders', 'buy-again', role],
    queryFn: checkoutApi.buyAgain,
    enabled: isLoggedIn,
    staleTime: 60_000,
  });
  const items: BuyAgainItem[] = isLoggedIn
    ? (query.data ?? []).map((p) => ({
        ...toShelfProduct(p),
        lastOrderedAt: p.lastOrderedAt,
        lastQuantity: p.lastQuantity,
        timesOrdered: p.timesOrdered,
      }))
    : [];
  return { items, isLoading: query.isLoading && isLoggedIn };
}

/** "Today", "Yesterday", "5 days ago", else "3 Oct" / "3 Oct 2025". */
export function lastOrderedLabel(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).getTime();
  const then = new Date(iso);
  const days = Math.round((day(now) - day(then)) / 864e5);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(then.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    timeZone: 'Asia/Kolkata',
  });
}
