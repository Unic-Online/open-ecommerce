/**
 * Client-side React context exposing the active MarketConfig.
 *
 * Invariants:
 *   - `MarketProvider` is mounted exactly once, in the storefront `[locale]/layout.tsx`.
 *     Routes outside `[locale]` (admin, recover, revolut-pay) intentionally don't
 *     have a market provider — those flows resolve the market server-side from
 *     the request host or from the persisted order doc.
 *   - `useMarket()` THROWS when called outside a provider, on purpose: silently
 *     defaulting to RO would mask FR-market bugs.
 * Side effects: none.
 */
'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { MarketConfig } from '@/lib/market';

const MarketContext = createContext<MarketConfig | null>(null);

export function MarketProvider({
  value,
  children,
}: {
  value: MarketConfig;
  children: ReactNode;
}) {
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketConfig {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used inside <MarketProvider>');
  return ctx;
}
