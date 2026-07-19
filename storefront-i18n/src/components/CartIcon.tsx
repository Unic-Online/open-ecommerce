'use client';

import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/cart-context';
import styles from './CartIcon.module.css';

export default function CartIcon() {
  const { totalItems, setCartOpen } = useCart();
  const t = useTranslations('cart');

  return (
    <button
      className={styles.cartBtn}
      onClick={() => setCartOpen(true)}
      aria-label={t('iconAria', { count: totalItems })}
      data-testid="cart-toggle"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
      {totalItems > 0 && (
        <span className={styles.badge}>{totalItems}</span>
      )}
    </button>
  );
}
