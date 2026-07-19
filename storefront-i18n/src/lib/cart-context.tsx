'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { CartItemData } from './types';
import { getCurrentUnitPrice } from './cart-price-validator';
import { useMarket } from '@/i18n/market-context';
import type { MarketKey } from '@/i18n/market-config';
import { storage } from '@/site.config';

interface CartContextType {
  items: CartItemData[];
  addItem: (item: CartItemData) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

// Exported so the recovery URL flow (which renders outside the
// [locale] layout and therefore has no CartProvider in its tree) can
// hydrate the cart by writing to the same key, then bouncing the user to
// a route under [locale] where the provider mounts and reads it back.
export const CART_STORAGE_KEY = storage.localStorage.cart;

function loadCart(market: MarketKey): CartItemData[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeCartItem)
      .filter((item): item is CartItemData => item !== null)
      // Drop items whose stored unitPrice no longer matches the current
      // market price. A returning visitor must never see a stale price at
      // checkout — server-side pricing.computeOrderTotal would re-derive the
      // total anyway, but quietly charging a different number than the cart
      // shows is worse than asking them to re-add the item.
      .filter((item) => {
        const current = getCurrentUnitPrice(item.productType, item.slug, market);
        return current !== null && current === item.unitPrice;
      });
  } catch {
    return [];
  }
}

function saveCart(items: CartItemData[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const market = useMarket();
  const [items, setItems] = useState<CartItemData[]>([]);
  const [isCartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedItems = loadCart(market.key);
    // Synchronous hydration: a transition here can be reordered by concurrent
    // React relative to a click that fires before mount completes, which is
    // the source of the "Add to Cart needs two clicks" symptom.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate synchronous hydration (see above); deferring this set reintroduces the two-clicks race
    setItems(currentItems => (currentItems.length > 0 ? currentItems : storedItems));
    setHydrated(true);
  }, [market.key]);

  useEffect(() => {
    if (hydrated) {
      saveCart(items);
    }
  }, [items, hydrated]);

  const addItem = useCallback((newItem: CartItemData) => {
    // Invariant: addItem MERGES on existing id (sums quantity). The
    // recovery URL flow writes to localStorage directly via
    // CART_STORAGE_KEY (see RecoverClient) and bounces to a cart route,
    // where loadCart() rehydrates — bypasses this merge on purpose so a
    // recovered cart doesn't stack on top of items in another tab.
    setItems(prev => {
      const existing = prev.find(item => item.id === newItem.id);
      if (existing) {
        return prev.map(item =>
          item.id === newItem.id
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        );
      }
      return [...prev, newItem];
    });
    setCartOpen(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isCartOpen, setCartOpen }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isCartOpen]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

const VALID_PRODUCT_TYPES = new Set(['furniture', 'lighting', 'outdoor']);

// Invariant: returns null on ANY malformed field — caller must filter nulls.
// Silent-drop is intentional: localStorage payloads can be from older app
// versions where the cart shape differed; throwing would break hydration.
function normalizeCartItem(value: unknown): CartItemData | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;

  const id = typeof item.id === 'string' ? item.id : null;
  const productName = typeof item.productName === 'string' ? item.productName : null;
  const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : null;
  const image = typeof item.image === 'string' ? item.image : null;
  if (!id || !productName || !quantity) return null;

  if (typeof item.productType !== 'string' || !VALID_PRODUCT_TYPES.has(item.productType)) {
    return null;
  }

  const slug = typeof item.slug === 'string' && item.slug.trim() ? item.slug : null;
  const shortName =
    typeof item.shortName === 'string' && item.shortName.trim()
      ? item.shortName
      : productName;
  const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : null;
  if (!slug || unitPrice === null || !image) return null;

  return {
    id,
    productType: item.productType as CartItemData['productType'],
    productName,
    quantity,
    image,
    unitPrice,
    slug,
    shortName,
  };
}
