'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from '@/lib/strings';
import { useCart } from '@/lib/cart-context';
import { useMarket } from '@/lib/market-context';
import { trackAddToCart } from '@/lib/analytics';
import { logProductEvent } from '@/lib/observability';
import { formatMoney } from '@/lib/format';
import { categoryToCartType, type ProductTemplate } from '@/lib/product';
import { MARKET } from '@/site.config';
import styles from './product.module.css';

interface Props {
  product: ProductTemplate;
}

export default function FloatingCartBar({ product }: Props) {
  const { addItem } = useCart();
  const t = useTranslations('product.floatingBar');
  const market = useMarket();
  const [visible, setVisible] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const checkVisibility = useCallback(() => {
    // Show the fallback as soon as the fixed header starts covering the main CTA.
    const cta = document.querySelector(`.${styles.cartRow}`);
    if (!cta) return;
    const header = document.querySelector('header');
    const headerBottom = header?.getBoundingClientRect().bottom ?? 64;
    const rect = cta.getBoundingClientRect();
    setVisible(rect.top < headerBottom);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);
    window.visualViewport?.addEventListener('resize', checkVisibility);
    const frame = window.requestAnimationFrame(checkVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
      window.visualViewport?.removeEventListener('resize', checkVisibility);
    };
  }, [checkVisibility]);

  const handleAdd = () => {
    const firstImage = product.gallery[0]?.src ?? '';
    const productType = categoryToCartType(product.category);
    addItem({
      id: `${productType}__${product.slug}`,
      productType,
      productName: product.fullTitle,
      shortName: product.shortName,
      slug: product.slug,
      quantity: 1,
      image: firstImage,
      unitPrice: product.price,
    });

    trackAddToCart(product.shortName, '1', product.price, undefined, {
      contentId: `${productType}__${product.slug}`,
      currency: MARKET.currency,
    });
    logProductEvent('product_add_to_cart', {
      slug: product.slug,
      qty: '1',
      price: String(product.price),
      productType,
    });

    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 600);
  };

  return (
    <div className={`${styles.floatingBar} ${visible ? styles.floatingBarVisible : ''}`}>
      <div className={styles.floatingInner}>
        <div className={styles.floatingInfo}>
          <span className={styles.floatingName}>{product.shortName}</span>
          <span className={styles.floatingPrice}>{formatMoney(product.price, market.currency)}</span>
        </div>
        <button
          type="button"
          className={styles.floatingCta}
          onClick={handleAdd}
          aria-busy={justAdded}
        >
          {justAdded ? t('added') : t('addToCart')}
        </button>
      </div>
    </div>
  );
}
