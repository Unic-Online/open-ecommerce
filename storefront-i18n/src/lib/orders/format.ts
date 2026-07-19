import { formatMoney } from '@/lib/format';
import type { OrderDoc } from './types';

/**
 * Money formatter bound to the order's recorded currency + locale. Use this
 * everywhere in the admin orders UI — never `formatPrice` (RO-only legacy)
 * and never `formatMoney` with a guessed currency.
 */
export function formatOrderMoney(
  order: Pick<OrderDoc, 'currency' | 'locale'>,
  amount: number,
): string {
  return formatMoney(amount, order.currency, order.locale);
}
