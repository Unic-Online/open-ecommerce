import { formatMoney } from '@/lib/format';
import type { OrderDoc } from './types';

/**
 * Money formatter bound to the order's recorded currency. Use this everywhere
 * in the admin orders UI — never `formatMoney` with a guessed currency.
 */
export function formatOrderMoney(order: Pick<OrderDoc, 'currency'>, amount: number): string {
  return formatMoney(amount, order.currency);
}
