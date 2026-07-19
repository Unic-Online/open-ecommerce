/**
 * GET /api/admin/orders/export — CSV export of orders matching the current
 * dashboard filters.
 *
 * Invariants:
 *   - Auth-gated by `requireAdmin()` — unauthenticated callers get 401.
 *   - Buffered (not streamed) and capped at 10 000 rows for v1. Beyond that
 *     we'd need a streaming response and a date filter.
 *   - UTF-8 BOM (`﻿`) prepended so Excel-RO opens it as UTF-8 and
 *     diacritics render correctly.
 *   - Cells are formula-injection-guarded by `escapeCsvCell` (CWE-1236).
 * Side effects: reads from `orders` collection.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { listOrders, type ListOrdersFilters } from '@/lib/orders/queries';
import { CSV_HEADER, toCsvRow } from '@/lib/orders/csv';
import {
  ORDER_STATUSES,
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
  type OrderStatus,
} from '@/lib/orders/status-machine';

export const dynamic = 'force-dynamic';

const EXPORT_LIMIT = 10_000;

function pickEnum<T extends string>(
  raw: string | null,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  return raw && (allowed as ReadonlyArray<string>).includes(raw) ? (raw as T) : fallback;
}

function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  if (isAbandonedCartDryRun()) {
    return NextResponse.json({ ok: false, reason: 'dry-run' }, { status: 503 });
  }

  const sp = request.nextUrl.searchParams;

  const statusOptions = ['all', ...ORDER_STATUSES] as const;
  const fulfillmentOptions = ['all', ...FULFILLMENT_STATUSES] as const;

  const filters: ListOrdersFilters = {
    status: pickEnum<OrderStatus | 'all'>(
      sp.get('status'),
      statusOptions,
      'all',
    ),
    paymentMethod: pickEnum<'cod' | 'card' | 'all'>(
      sp.get('paymentMethod'),
      ['all', 'cod', 'card'],
      'all',
    ),
    market: pickEnum<'main' | 'all'>(
      sp.get('market'),
      ['all', 'main'],
      'all',
    ),
    fulfillment: pickEnum<FulfillmentStatus | 'all'>(
      sp.get('fulfillment'),
      fulfillmentOptions,
      'all',
    ),
    q: sp.get('q') || undefined,
    from: parseDate(sp.get('from')),
    to: parseDate(sp.get('to')),
    skip: 0,
    limit: EXPORT_LIMIT,
  };

  // TODO(volume): switch to streaming if monthly volume exceeds 10k.
  const { orders } = await listOrders(filters);

  const csv = '﻿' + [CSV_HEADER, ...orders.map(toCsvRow)].join('\n');
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
