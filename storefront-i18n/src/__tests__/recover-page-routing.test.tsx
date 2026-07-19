import { describe, it, expect, vi, beforeEach } from 'vitest';

// Why this test exists: the /recover/[token] page used to hardcode
// `router.replace('/comanda')` after a successful recovery, which 404'd on
// `www.shop.example.com` (the EN canonical path is /cart). A second bug hid
// behind it: on hosts that are NOT configured market domains (localhost,
// Vercel previews) next-intl routes with localePrefix 'as-needed' under the
// default locale, so an unprefixed non-default-locale path ('/comanda') was
// normalized to the default locale's route ('/cart') — english market —
// whose price guard then dropped the just-recovered RON items. This test
// pins the per-market, per-host cartPath so neither regression can return.

vi.mock('@/i18n/market-resolver', () => ({
  getCurrentMarket: vi.fn(),
}));

let mockHost = 'localhost:3000';
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ host: mockHost })),
}));

import RecoverPage from '../app/recover/[token]/page';
import { getCurrentMarket } from '@/i18n/market-resolver';

describe('Recovery page — per-market cart redirect', () => {
  beforeEach(() => {
    vi.mocked(getCurrentMarket).mockReset();
    mockHost = 'localhost:3000';
  });

  it('locale-prefixes the RO cart path on non-market hosts (localhost/previews)', async () => {
    vi.mocked(getCurrentMarket).mockResolvedValueOnce('ro');

    const element = await RecoverPage({
      params: Promise.resolve({ token: 'tok-ro' }),
    });

    expect(element.props).toMatchObject({
      token: 'tok-ro',
      cartPath: '/ro/comanda',
      market: 'ro',
      loadingText: 'Restaurăm coșul tău…',
    });
  });

  it('passes the unprefixed /comanda on the RO market domain (domain routing)', async () => {
    mockHost = 'ro.shop.example.com';
    vi.mocked(getCurrentMarket).mockResolvedValueOnce('ro');

    const element = await RecoverPage({
      params: Promise.resolve({ token: 'tok-ro-domain' }),
    });

    expect(element.props).toMatchObject({
      token: 'tok-ro-domain',
      cartPath: '/comanda',
      market: 'ro',
    });
  });

  it('passes /cart + market=english on the english market (catches the www.shop.example.com bug)', async () => {
    mockHost = 'shop.example.com';
    vi.mocked(getCurrentMarket).mockResolvedValueOnce('english');

    const element = await RecoverPage({
      params: Promise.resolve({ token: 'tok-en' }),
    });

    expect(element.props).toMatchObject({
      token: 'tok-en',
      cartPath: '/cart',
      market: 'english',
      loadingText: 'Restoring your basket…',
    });
  });

  it('default locale stays unprefixed even on non-market hosts', async () => {
    vi.mocked(getCurrentMarket).mockResolvedValueOnce('english');

    const element = await RecoverPage({
      params: Promise.resolve({ token: 'tok-en-local' }),
    });

    expect(element.props).toMatchObject({
      token: 'tok-en-local',
      cartPath: '/cart',
      market: 'english',
    });
  });
});
