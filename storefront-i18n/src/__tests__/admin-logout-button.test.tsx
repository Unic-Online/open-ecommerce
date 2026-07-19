/**
 * Admin LogoutButton (issue #51) — a failed logout request must NOT be
 * silently swallowed (leaving the operator logged in with no feedback), and a
 * double-click must not fire concurrent requests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

import LogoutButton from '@/app/admin/LogoutButton';

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockClear();
  refresh.mockClear();
});
afterEach(() => cleanup());

describe('LogoutButton', () => {
  it('navigates to login on a successful logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/login'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces an error and stays on the page when logout fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
    // Re-enabled so the operator can retry.
    expect(screen.getByRole('button', { name: /sign out/i })).not.toBeDisabled();
  });

  it('does not fire a second request while one is in flight', async () => {
    let resolve: (v: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<LogoutButton />);
    const btn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(btn);
    fireEvent.click(btn); // ignored: button disabled + busy guard
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true });
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });
});
