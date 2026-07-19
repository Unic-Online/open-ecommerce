/**
 * Admin RefundForm (issue #52) — once a refund POST is in flight, a second
 * submit must not fire another request (no double-refund window), and an
 * invalid amount must not call the API at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

import { RefundForm } from '@/app/admin/(authed)/orders/[orderId]/_components/RefundForm.client';

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});
afterEach(() => cleanup());

describe('RefundForm', () => {
  it('does not POST a second refund while the first is in flight', async () => {
    let resolve: (v: unknown) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise((r) => { resolve = r; }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(
      <RefundForm orderId="ABCD1234" totalPrice={100} currency="RON" alreadyRefunded={false} />,
    );
    const form = container.querySelector('form') as HTMLFormElement;
    // Submit twice directly on the form — this bypasses the button's
    // `disabled` attribute, so only the in-handler re-entrancy guard can stop
    // the second refund from firing.
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('does not call the API for an invalid amount', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <RefundForm orderId="ABCD1234" totalPrice={100} currency="RON" alreadyRefunded={false} />,
    );
    const input = screen.getByLabelText(/amount/i);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /record refund/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/must be > 0/i)).toBeInTheDocument();
  });
});
