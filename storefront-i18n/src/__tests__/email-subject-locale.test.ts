/**
 * Customer email subjects must follow the ORDER's locale — every market,
 * every send path. Regression for the "Romanian subject on an `en` order"
 * bug: the routes hardcoded Romanian subjects, so customers on the default
 * `english` market received `Confirmare comandă #X` / `Comanda ta — #X`.
 *
 * Covers:
 *   - the locale-keyed subject helper in lib/emails/customer-order-email.ts
 *   - the /resend-email admin route (reads locale off the persisted order)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mongoMock } from './helpers/mongodb.mock';
import { resendLibModule, sendEmailMock } from './helpers/resend.mock';
import { buildOrder } from './helpers/builders';

const { mockRequireAdmin, mockGetOrder, mockIsDryRun } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockGetOrder: vi.fn(),
  mockIsDryRun: vi.fn(() => false),
}));

vi.mock('@/plugins/abandoned-cart/server/admin-auth', () => ({
  requireAdmin: mockRequireAdmin,
}));
vi.mock('@/lib/orders/queries', () => ({ getOrder: mockGetOrder }));
vi.mock('@/lib/resend', () => resendLibModule());
vi.mock('@/lib/mongodb', () => mongoMock.module());
vi.mock('@/plugins/abandoned-cart/config', () => ({
  isAbandonedCartDryRun: mockIsDryRun,
}));

import { POST as resendEmailPOST } from '@/app/api/admin/orders/[orderId]/resend-email/route';

function call(orderId: string): Promise<Response> {
  const request = new Request(`http://localhost/api/admin/orders/${orderId}/resend-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return resendEmailPOST(request, { params: Promise.resolve({ orderId }) });
}

beforeEach(() => {
  mongoMock.reset();
  mockRequireAdmin.mockResolvedValue({ ok: true });
  mockIsDryRun.mockReturnValue(false);
  sendEmailMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
});

describe('POST /resend-email — subject follows the order locale', () => {
  it('en order gets an English subject, never Romanian', async () => {
    const order = buildOrder({ market: 'english', locale: 'en', currency: 'EUR' });
    mockGetOrder.mockResolvedValueOnce(order);

    const res = await call(order.orderId);

    expect(res.status).toBe(200);
    const sent = sendEmailMock.mock.calls[0][0];
    expect(sent.subject).toBe(`Order confirmation #${order.orderId}`);
    expect(sent.subject).not.toContain('Confirmare');
  });

  it('ro order keeps the Romanian subject', async () => {
    const order = buildOrder();
    mockGetOrder.mockResolvedValueOnce(order);

    await call(order.orderId);

    expect(sendEmailMock.mock.calls[0][0].subject).toBe(
      `Confirmare comandă #${order.orderId}`,
    );
  });
});

describe('customerOrderEmailSubject — locale-keyed helper', () => {
  it('emits the right language for every locale × send path', async () => {
    // Dynamic import so the route tests above fail behaviorally (not on a
    // missing export) when run against the pre-fix base.
    const { customerOrderEmailSubject } = await import('@/lib/emails/customer-order-email');

    expect(customerOrderEmailSubject('ro', 'placed', 'AB12CD34')).toBe('Comanda ta — #AB12CD34');
    expect(customerOrderEmailSubject('en', 'placed', 'AB12CD34')).toBe('Your order — #AB12CD34');

    expect(customerOrderEmailSubject('ro', 'paid', 'AB12CD34')).toBe('Mulțumim pentru comandă — #AB12CD34');
    expect(customerOrderEmailSubject('en', 'paid', 'AB12CD34')).toBe('Thank you for your order — #AB12CD34');

    expect(customerOrderEmailSubject('ro', 'resend', 'AB12CD34')).toBe('Confirmare comandă #AB12CD34');
    expect(customerOrderEmailSubject('en', 'resend', 'AB12CD34')).toBe('Order confirmation #AB12CD34');
  });

  it('falls back to Romanian for legacy orders missing a locale', async () => {
    const { customerOrderEmailSubject } = await import('@/lib/emails/customer-order-email');
    expect(
      customerOrderEmailSubject(undefined as unknown as 'ro', 'resend', 'AB12CD34'),
    ).toBe('Confirmare comandă #AB12CD34');
  });
});
