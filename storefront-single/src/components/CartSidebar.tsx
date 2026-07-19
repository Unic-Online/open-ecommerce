'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from '@/lib/strings';
import { useRouter } from '@/lib/nav';
import { useCart } from '@/lib/cart-context';
import { useMarket } from '@/lib/market-context';
import { trackCartInitiateCheckoutOnce } from '@/lib/analytics';
import { formatMoney } from '@/lib/format';
import { getLineItemTotal, getLineItemVariantSummary } from '@/lib/line-items';
import { computeOrderTotal } from '@/lib/pricing';
import styles from './CartSidebar.module.css';

// Same-URL history sentinel: the drawer is full-viewport on phones and lives
// in the persistent layout, so without an entry of its own a back press
// navigates the page invisibly BEHIND the open drawer. The sentinel makes
// the first back press close the drawer instead. Same pattern as the
// abandoned-cart exit-intent back-intercept (they compose — each module only
// reacts to its own key and spreads foreign state through).
const BACK_SENTINEL_KEY = 'storeCartSentinel';

export default function CartSidebar() {
  const { items, removeItem, updateQuantity, totalItems, isCartOpen, setCartOpen } = useCart();
  const router = useRouter();
  const t = useTranslations('cart');
  const market = useMarket();
  const fmt = (amount: number) => formatMoney(amount, market.currency);

  // Why: passing shipping is required so the total/shippingLabel reflect
  // FR's 10 EUR / 300 EUR threshold instead of RO's 29 / 600 defaults
  // (server already passes marketConfig.shipping in /api/order, this
  // aligns the displayed numbers).
  const totals = computeOrderTotal(items, { shipping: market.shipping });
  const shippingLabel = totals.shippingCost === 0 ? t('shippingFree') : fmt(totals.shippingCost);
  const freeThreshold = market.shipping.freeThreshold;
  const freeShippingRemaining = Math.max(0, freeThreshold - totals.subtotal);
  const freeShippingProgress = Math.min(100, Math.round((totals.subtotal / freeThreshold) * 100));

  useEffect(() => {
    if (!isCartOpen) return;

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    const previousBody = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };
    const previousHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previousBody.overflow;
      body.style.position = previousBody.position;
      body.style.top = previousBody.top;
      body.style.width = previousBody.width;
      body.style.paddingRight = previousBody.paddingRight;
      documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [isCartOpen]);

  useEffect(() => {
    if (!isCartOpen) return;

    if (!window.history.state?.[BACK_SENTINEL_KEY]) {
      try {
        // Spread the current state so Next's internal router tree survives
        // on the cloned entry.
        window.history.pushState(
          { ...(window.history.state ?? {}), [BACK_SENTINEL_KEY]: true },
          '',
          window.location.href,
        );
      } catch {
        /* history API rate-limited or denied — back falls through to navigation */
      }
    }

    const onPopState = (e: PopStateEvent) => {
      // Why: close only when the sentinel entry was popped away — a popstate
      // landing ON the sentinel (back from a deeper page) must not close.
      if (!e.state?.[BACK_SENTINEL_KEY]) setCartOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isCartOpen, setCartOpen]);

  // Why: UI close must consume the sentinel entry, otherwise the next back
  // press silently pops a stale same-URL entry instead of navigating.
  function closeCart() {
    setCartOpen(false);
    if (window.history.state?.[BACK_SENTINEL_KEY]) window.history.back();
  }

  function handleCheckout() {
    setCartOpen(false);

    // Once-guarded: the checkout page mount consults the same marker, so
    // this path and a direct /checkout navigation never double-fire.
    trackCartInitiateCheckoutOnce({
      contentIds: items.map(i => i.id),
      numItems: totalItems,
      value: totals.total,
      currency: market.currency,
      items: items.map(i => ({
        id: i.id,
        name: i.shortName,
        price: i.unitPrice,
        quantity: i.quantity,
      })),
    });

    // Why: replace consumes the sentinel entry, so back from /checkout lands
    // on the pre-cart page in one press instead of a dead same-URL pop.
    if (window.history.state?.[BACK_SENTINEL_KEY]) {
      router.replace('/checkout');
    } else {
      router.push('/checkout');
    }
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${isCartOpen ? styles.backdropOpen : ''}`}
        onClick={closeCart}
      />

      <aside
        className={`${styles.sidebar} ${isCartOpen ? styles.sidebarOpen : ''}`}
        data-testid="cart-sidebar"
        data-open={isCartOpen ? 'true' : 'false'}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{t('title', { count: totalItems })}</h3>
          <button className={styles.closeBtn} onClick={closeCart} aria-label={t('close')} data-testid="cart-close">✕</button>
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>{t('empty')}</p>
            <p className={styles.emptyHint}>{t('emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className={styles.items}>
              {items.map(item => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemImage}>
                    <Image
                      src={item.image}
                      alt={item.productName}
                      width={80}
                      height={60}
                      quality={80}
                    />
                  </div>
                  <div className={styles.itemDetails}>
                    <p className={styles.itemName}>{item.productName}</p>
                    <p className={styles.itemVariant}>
                      {getLineItemVariantSummary(item)}
                    </p>
                    <div className={styles.itemActions}>
                      <div className={styles.itemQty}>
                        <button
                          className={styles.itemQtyBtn}
                          aria-label={t('decreaseQuantity')}
                          data-testid="cart-item-decrease"
                          onClick={() => {
                            if (item.quantity <= 1) {
                              removeItem(item.id);
                            } else {
                              updateQuantity(item.id, item.quantity - 1);
                            }
                          }}
                        >
                          −
                        </button>
                        <span className={styles.itemQtyVal}>{item.quantity}</span>
                        <button
                          className={styles.itemQtyBtn}
                          aria-label={t('increaseQuantity')}
                          data-testid="cart-item-increase"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <span className={styles.itemPrice}>
                        {fmt(getLineItemTotal(item))}
                      </span>
                    </div>
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeItem(item.id)}
                    aria-label={t('removeItem')}
                    title={t('removeTitle')}
                    data-testid="cart-item-remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.footer}>
              <div className={styles.subtotal}>
                <span>{t('subtotal')}</span>
                <span>{fmt(totals.subtotal)}</span>
              </div>
              <div className={styles.subtotal}>
                <span>{t('shipping')}</span>
                <span className={styles.shippingValue}>{shippingLabel}</span>
              </div>
              <div
                className={styles.shippingProgress}
                aria-label={
                  freeShippingRemaining > 0
                    ? t('freeShippingRemainingAria', { amount: fmt(freeShippingRemaining) })
                    : t('freeShippingActiveAria')
                }
              >
                <div className={styles.progressTrack}>
                  <span
                    className={styles.progressFill}
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
                <p className={styles.progressText}>
                  {freeShippingRemaining > 0
                    ? t.rich('freeShippingRemaining', {
                        amount: fmt(freeShippingRemaining),
                        strong: (chunks) => <strong>{chunks}</strong>,
                      })
                    : <strong>{t('freeShippingActive')}</strong>}
                </p>
              </div>
              <div className={styles.subtotal}>
                <span>{t('total')}</span>
                <span className={styles.subtotalValue}>{fmt(totals.subtotal + totals.shippingCost)}</span>
              </div>
              <p className={styles.shipping}>{t('freeShippingHint', { amount: fmt(freeThreshold) })}</p>
              <button className={styles.checkoutBtn} onClick={handleCheckout} data-testid="cart-checkout">
                {t('checkout')}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
