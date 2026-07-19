'use client';

import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useTranslations } from '@/lib/strings';
import { Link } from '@/lib/nav';
import { useCart } from '@/lib/cart-context';
import { useMarket } from '@/lib/market-context';
import { formatMoney } from '@/lib/format';
import { computeOrderTotal, WELCOME_DISCOUNT, WELCOME_DISCOUNT_PERCENT } from '@/lib/pricing';
import {
  getAppliedCouponServerSnapshot,
  getAppliedCouponSnapshot,
} from '@/lib/applied-coupon';
import { toTemplateStub } from '@/lib/product-schema';
import { getDefinedProduct } from '@/../content/products';
import { getMarketPrice } from '@/data/products/prices';
import styles from './comanda.module.css';

// Cart upsell — surfaced when the cart is below the free-shipping threshold.
// Points at an inexpensive demo product; swap the slug to feature another.
const UPSELL = toTemplateStub(getDefinedProduct('oslo-nightstand')!);

// The applied recovery coupon is a read-once external value: nothing rewrites
// it while this page is mounted, so a no-op subscription plus the cached
// snapshot mirrors the previous read-once-on-mount behavior.
function subscribeToNothing() {
  return () => {};
}

export default function ComandaPage() {
  const { items, addItem, removeItem, updateQuantity } = useCart();
  const t = useTranslations('cart.page');
  const tCart = useTranslations('cart');
  const market = useMarket();
  const fmt = (amount: number) => formatMoney(amount, market.currency);
  // Resolve the upsell's price once for both display and the cart write below.
  const upsellMarketPrice = getMarketPrice(`${UPSELL.category}__${UPSELL.slug}`);
  const upsellPrice = upsellMarketPrice?.price ?? UPSELL.price;
  const upsellOldPrice = upsellMarketPrice?.oldPrice ?? UPSELL.oldPrice;
  const coupon = useSyncExternalStore(
    subscribeToNothing,
    getAppliedCouponSnapshot,
    getAppliedCouponServerSnapshot,
  );

  const totals = computeOrderTotal(items, {
    couponDiscountPercent: coupon?.discountPercent,
    // Why: without this, displayed shipping/total used RO_SHIPPING (29 RON)
    // even on FR — the server still charged the correct amount via
    // marketConfig.shipping in /api/order, but the displayed-vs-charged
    // mismatch is a UX (and arguably legal) issue.
    shipping: market.shipping,
  });
  // Split the combined discount into "welcome" + "coupon" parts so the
  // breakdown can show both lines distinctly.
  const welcomeDiscount = Math.round(totals.subtotal * WELCOME_DISCOUNT);
  const couponDiscount = Math.max(0, totals.discount - welcomeDiscount);
  const shippingLabel = totals.shippingCost === 0 ? tCart('shippingFree') : fmt(totals.shippingCost);
  // Why: previously hardcoded to FREE_SHIPPING_THRESHOLD (600 RON), which
  // made the "X more for free shipping" copy and the progress bar tell FR
  // users they needed e.g. 491 € more when FR free shipping actually kicks
  // in at 300 €. market.shipping.freeThreshold is the source of truth.
  const freeThreshold = market.shipping.freeThreshold;
  const freeShippingRemaining = Math.max(0, freeThreshold - totals.subtotal);
  const freeShippingProgress = Math.min(100, Math.round((totals.subtotal / freeThreshold) * 100));

  if (items.length === 0) {
    return (
      <div className={`${styles.page} container`}>
        <div className={styles.empty}>
          <h1>{t('emptyTitle')}</h1>
          <p>{t('emptyHint')}</p>
          <Link href="/furniture" className="btn btn-whatsapp">
            {t('viewSafes')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} container`}>
      <h1>{t('title')}</h1>

      <ul className={styles.list} role="list">
        {items.map((item) => (
          <li key={item.id} className={styles.row}>
            <div className={styles.imageWrap}>
              {item.image && (
                <Image
                  src={item.image}
                  alt={item.productName}
                  width={80}
                  height={80}
                  className={styles.image}
                />
              )}
            </div>
            <div className={styles.info}>
              <p className={styles.name}>{item.productName}</p>
              <p className={styles.unit}>
                {fmt(item.unitPrice)} × {item.quantity}
              </p>
            </div>
            <div className={styles.qtyControl}>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                aria-label={t('decrease')}
              >
                −
              </button>
              <span>{item.quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                aria-label={t('increase')}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className={styles.remove}
              onClick={() => removeItem(item.id)}
              aria-label={t('remove')}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.summaryRows}>
        <div className={styles.summaryRow}>
          <span>{tCart('subtotal')}</span>
          <span>{fmt(totals.subtotal)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>{t('welcomeDiscount', { percent: WELCOME_DISCOUNT_PERCENT })}</span>
          <span>-{fmt(welcomeDiscount)}</span>
        </div>
        {coupon && couponDiscount > 0 && (
          <div className={styles.summaryRow} style={{ color: '#1a8a4a', fontWeight: 600 }}>
            <span>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.66rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#1a8a4a',
                  background: 'rgba(26, 138, 74, 0.12)',
                  padding: '0.18rem 0.5rem',
                  borderRadius: '999px',
                  marginRight: '0.55rem',
                  verticalAlign: 'middle',
                  fontWeight: 700,
                }}
              >
                {t('couponApplied')}
              </span>
              <strong style={{ fontFamily: 'SF Mono, Menlo, monospace' }}>
                {coupon.code}
              </strong>{' '}
              (-{coupon.discountPercent}%)
            </span>
            <span>-{fmt(couponDiscount)}</span>
          </div>
        )}
        <div className={styles.summaryRow}>
          <span>{tCart('shipping')} {totals.shippingCost > 0 ? t('shippingWithFreeNote', { amount: fmt(freeThreshold) }) : ''}</span>
          <span>{shippingLabel}</span>
        </div>
        <div className={styles.shippingProgress}>
          <div className={styles.progressTrack}>
            <span className={styles.progressFill} style={{ width: `${freeShippingProgress}%` }} />
          </div>
          <p>
            {freeShippingRemaining > 0
              ? tCart.rich('freeShippingRemaining', {
                  amount: fmt(freeShippingRemaining),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })
              : <strong>{tCart('freeShippingActive')}</strong>}
          </p>
        </div>

        {/* --- Upsell card when the cart is below the active market's
              free-shipping threshold. --- */}
        {totals.subtotal < freeThreshold && !items.some(i => i.id === `${UPSELL.category}__${UPSELL.slug}`) && (
          <div className={styles.upsell}>
            <p className={styles.upsellTitle}>{t('upsellTitle')}</p>
            <div className={styles.upsellCard}>
              <div className={styles.upsellImageWrap}>
                <Image
                  src={UPSELL.gallery[0].src}
                  alt={UPSELL.shortName}
                  width={72}
                  height={72}
                  className={styles.upsellImage}
                />
              </div>
              <div className={styles.upsellInfo}>
                <p className={styles.upsellName}>{UPSELL.shortName}</p>
                <p className={styles.upsellTagline}>{UPSELL.tagline}</p>
                <div className={styles.upsellPrices}>
                  {upsellOldPrice && (
                    <span className={styles.upsellOldPrice}>{fmt(upsellOldPrice)}</span>
                  )}
                  <span className={styles.upsellPrice}>{fmt(upsellPrice)}</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.upsellBtn}
                onClick={() => addItem({
                  id: `${UPSELL.category}__${UPSELL.slug}`,
                  productType: UPSELL.category,
                  productName: UPSELL.fullTitle,
                  shortName: UPSELL.shortName,
                  quantity: 1,
                  image: UPSELL.gallery[0].src,
                  unitPrice: upsellPrice,
                  slug: UPSELL.slug,
                })}
              >
                {t('upsellAdd')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.totalRow}>
        <span>{tCart('total')}</span>
        <strong>{fmt(totals.total)}</strong>
      </div>

      <Link href="/checkout" className={styles.checkoutBtn}>
        {t('continueCheckout')}
      </Link>
    </div>
  );
}
