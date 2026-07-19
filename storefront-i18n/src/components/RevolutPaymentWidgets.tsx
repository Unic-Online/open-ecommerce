'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RevolutCheckout from '@revolut/checkout';
import type {
  RevolutPaymentsModuleInstance,
  RevolutCheckoutCardField,
  RevolutCheckoutError,
} from '@revolut/checkout';
import { useLocale, useTranslations } from 'next-intl';
import { clientEnv } from '@/env';
import { useCart } from '@/lib/cart-context';
import { useMarket } from '@/i18n/market-context';
import type { LocaleKey } from '@/i18n/locales';
import { hasMarketingConsent } from '@/lib/consent';
import { getMetaTestEventCode, getMetaTrackingPayload } from '@/lib/analytics';
import { getLineItemUnitPrice } from '@/lib/line-items';
import { computeOrderTotal, toMinorUnits } from '@/lib/pricing';
import { formatMoney } from '@/lib/format';
import type { ShippingData, OrderItem } from '@/lib/validation';
import type { CheckoutExperimentAssignment } from '@/lib/ab-testing';
import styles from './RevolutPaymentWidgets.module.css';

interface Props {
  shipping: ShippingData;
  shippingValid: boolean;
  items: OrderItem[];
  // Recovery-coupon code if the user activated one via /recover/[token].
  // Server re-validates and atomically redeems at order placement.
  couponCode?: string;
  // Discount % the coupon adds on top of the default welcome discount.
  // Used here only for the wallet button's amount label.
  couponDiscountPercent?: number;
  experiments?: CheckoutExperimentAssignment;
  onSuccess: (orderId: string) => void;
  onError: (msg: string) => void;
}

const PUBLIC_KEY = clientEnv.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY ?? '';
const MODE: 'prod' | 'sandbox' =
  clientEnv.NEXT_PUBLIC_REVOLUT_API_MODE === 'sandbox' ? 'sandbox' : 'prod';
// Map our LocaleKey to a value the Revolut SDK accepts. Pinning the SDK locale
// keeps the card iframe placeholders aligned with the rest of the checkout
// instead of falling back to the browser UI language. 'ro' and 'en'
// are all in @revolut/checkout LOCALES.
const SDK_LOCALE: Record<LocaleKey, 'ro' | 'en'> = {
  ro: 'ro',
  en: 'en',
};
// The wallet button widget (revolutPay + paymentRequest) is served from a
// separate CDN bundle whose supported-locale list is narrower than the SDK's
// declared LOCALES — 'ro' is missing and triggers a DEVELOPER_ERROR fallback
// to browser locale. Buttons only render brand text + amount, so degrading
// 'ro' to 'en' has no user-visible effect.
const WALLET_BUTTON_LOCALE: Record<LocaleKey, 'en'> = {
  ro: 'en',
  en: 'en',
};

type CreateOrderResponse = { orderId: string; publicId: string; checkoutUrl?: string };

export function RevolutPaymentWidgets({
  shipping,
  shippingValid,
  items,
  couponCode,
  couponDiscountPercent,
  experiments,
  onSuccess,
  onError,
}: Props) {
  const { clearCart } = useCart();
  const t = useTranslations('payment');
  const market = useMarket();
  const locale = useLocale() as LocaleKey;

  const revolutPayRef = useRef<HTMLDivElement>(null);
  const paymentRequestRef = useRef<HTMLDivElement>(null);
  const cardFieldRef = useRef<HTMLDivElement>(null);

  const [walletAvailable, setWalletAvailable] = useState<'applePay' | 'googlePay' | null>(null);
  const [cardState, setCardState] = useState<'idle' | 'preparing' | 'ready'>('idle');
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [cardSessionKey, setCardSessionKey] = useState<string | null>(null);

  const cardFieldInst = useRef<RevolutCheckoutCardField | null>(null);
  const walletOrderId = useRef<string | null>(null);
  const cardOrderId = useRef<string | null>(null);
  // Why: monotonic seq guards async card-init races. Each prepareCardSession()
  // bump invalidates any in-flight init from a previous shipping/cart edit so
  // a stale `RC.createCardField` resolves into a no-op instead of mounting on
  // top of the new session.
  const cardInitSeq = useRef(0);

  // Refs for everything the SDK callbacks read so the effect deps stay stable.
  const shippingRef = useRef(shipping);
  const itemsRef = useRef(items);
  const shippingValidRef = useRef(shippingValid);
  const couponCodeRef = useRef(couponCode);
  const experimentsRef = useRef(experiments);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const clearCartRef = useRef(clearCart);

  const sdkLocale = SDK_LOCALE[locale];
  const walletButtonLocale = WALLET_BUTTON_LOCALE[locale];
  const totals = computeOrderTotal(items, {
    couponDiscountPercent,
    // Pass the active market's shipping so EUR/FR carts compute the FR
    // 10 € flat fee + 300 € free threshold instead of the RO defaults.
    shipping: market.shipping,
  });
  const walletAmountMinor = toMinorUnits(totals.total, market.currency);
  const paymentContextKey = useMemo(
    () => makePaymentContextKey(shipping, items),
    [shipping, items]
  );

  useEffect(() => {
    shippingRef.current = shipping;
    itemsRef.current = items;
    shippingValidRef.current = shippingValid;
    couponCodeRef.current = couponCode;
    experimentsRef.current = experiments;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    clearCartRef.current = clearCart;
  }, [shipping, items, shippingValid, couponCode, experiments, onSuccess, onError, clearCart]);

  const assertShippingReady = useCallback((): true => {
    if (shippingValidRef.current) return true;
    const msg = t('errors.shippingRequired');
    onErrorRef.current(msg);
    throw new Error(msg);
  }, [t]);

  const createOrderApi = useCallback(async (): Promise<CreateOrderResponse> => {
    assertShippingReady();
    const marketingConsent = hasMarketingConsent();
    const testEventCode = getMetaTestEventCode();
    const res = await fetch('/api/payments/revolut/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipping: shippingRef.current,
        items: itemsRef.current,
        paymentMethod: 'card',
        marketingConsent,
        ...(marketingConsent ? { tracking: getMetaTrackingPayload() } : {}),
        ...(couponCodeRef.current ? { couponCode: couponCodeRef.current } : {}),
        ...(experimentsRef.current ? { experiments: experimentsRef.current } : {}),
        // Forward the browser's active Meta Test Events code so the webhook
        // (which fires CAPI Purchase out-of-band) can tag it. Persisted on
        // the order doc by /api/payments/revolut/create-order.
        ...(testEventCode ? { testEventCode } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.publicId || !data.orderId) {
      const msg = data.error || t('errors.cannotInitiate');
      onErrorRef.current(msg);
      throw new Error(msg);
    }
    return data as CreateOrderResponse;
  }, [assertShippingReady, t]);

  function destroyCardField() {
    try {
      cardFieldInst.current?.destroy?.();
    } catch {
      /* SDK destroy can throw after unmount */
    }
    cardFieldInst.current = null;
  }

  // -- Wallets (Revolut Pay + Apple/Google Pay) ------------------------------
  useEffect(() => {
    // Why: wallet buttons mint a Revolut order on click via `wrappedCreateOrder`,
    // which requires a valid shipping address (server enforces this in
    // create-order route). Mounting them before shipping is valid would let
    // the user trigger a wallet sheet that immediately fails server-side.
    if (!PUBLIC_KEY || !shippingValid) {
      walletOrderId.current = null;
      return;
    }

    let cancelled = false;
    let payments: RevolutPaymentsModuleInstance | null = null;
    const cleanup: Array<() => void> = [];

    (async () => {
      setWalletAvailable(null);
      try {
        payments = await RevolutCheckout.payments({
          locale: walletButtonLocale,
          mode: MODE,
          publicToken: PUBLIC_KEY,
        });
        if (cancelled || !payments) return;

        const wrappedCreateOrder = async () => {
          const { orderId, publicId } = await createOrderApi();
          walletOrderId.current = orderId;
          return { publicId };
        };

        // Revolut Pay button
        if (revolutPayRef.current) {
          payments.revolutPay.mount(revolutPayRef.current, {
            currency: market.currency,
            totalAmount: walletAmountMinor,
            createOrder: wrappedCreateOrder,
            validate: async () => assertShippingReady(),
            customer: makeWalletCustomer(shippingRef.current),
            mobileRedirectUrls: {
              success: `${market.baseUrl}/revolut-pay/return/success`,
              failure: `${market.baseUrl}/revolut-pay/return/failure`,
              cancel: `${market.baseUrl}/revolut-pay/return/cancel`,
            },
            buttonStyle: { variant: 'dark', size: 'large' },
          });
          payments.revolutPay.on('payment', (payload) => {
            if (payload.type === 'success') {
              const id = walletOrderId.current;
              if (id) {
                clearCartRef.current();
                onSuccessRef.current(id);
              }
              walletOrderId.current = null;
            } else if (payload.type === 'error') {
              walletOrderId.current = null;
              onErrorRef.current(payload.error?.message || t('errors.revolutPayFailed'));
            }
          });
          cleanup.push(() => payments?.revolutPay.destroy?.());
        }

        // Apple Pay / Google Pay (auto-detected)
        if (paymentRequestRef.current) {
          const inst = payments.paymentRequest(paymentRequestRef.current, {
            amount: walletAmountMinor,
            currency: market.currency,
            createOrder: wrappedCreateOrder,
            requestShipping: false,
            onSuccess: () => {
              const id = walletOrderId.current;
              if (id) {
                clearCartRef.current();
                onSuccessRef.current(id);
              }
              walletOrderId.current = null;
            },
            onError: (err: RevolutCheckoutError) => {
              walletOrderId.current = null;
              onErrorRef.current(err?.message || t('errors.walletFailed'));
            },
            onCancel: () => {
              walletOrderId.current = null;
            },
            buttonStyle: { variant: 'dark', size: 'large' },
          });
          const can = await inst.canMakePayment();
          if (cancelled) {
            inst.destroy();
            return;
          }
          if (can) {
            await inst.render();
            setWalletAvailable(can);
          } else {
            inst.destroy();
          }
          cleanup.push(() => inst.destroy());
        }
      } catch (err) {
        console.error('Revolut SDK init failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      walletOrderId.current = null;
      cleanup.forEach((fn) => {
        try {
          fn();
        } catch {
          /* destroy may throw if SDK already torn down */
        }
      });
      payments?.destroy?.();
    };
  }, [assertShippingReady, createOrderApi, shippingValid, walletAmountMinor, walletButtonLocale, market.currency, t]);

  // If the user edits shipping/cart after a card session exists, tear it down
  // and require an explicit re-init so the provider order always matches what
  // the customer is about to submit.
  useEffect(() => {
    if (!cardSessionKey || cardSessionKey === paymentContextKey) return;
    cardInitSeq.current += 1;
    destroyCardField();
    cardOrderId.current = null;

    queueMicrotask(() => {
      setCardState('idle');
      setCardSubmitting(false);
      setCardSessionKey(null);
    });
  }, [cardSessionKey, paymentContextKey]);

  const prepareCardSession = useCallback(async () => {
    if (!PUBLIC_KEY || !cardFieldRef.current) return;
    if (!shippingValidRef.current) {
      onErrorRef.current(t('errors.shippingRequired'));
      return;
    }

    const sessionSeq = ++cardInitSeq.current;
    const sessionKey = paymentContextKey;
    setCardState('preparing');
    setCardSubmitting(false);
    destroyCardField();
    cardOrderId.current = null;

    try {
      const { orderId, publicId } = await createOrderApi();
      if (sessionSeq !== cardInitSeq.current) return;
      cardOrderId.current = orderId;

      const RC = await RevolutCheckout(publicId, MODE);
      if (sessionSeq !== cardInitSeq.current) return;
      // Pin the card iframe to the storefront locale; otherwise its labels
      // follow the browser UI language and we end up with mixed copy on
      // the page (e.g. EN placeholders on a FR checkout).
      RC.setDefaultLocale?.(sdkLocale);

      const field = RC.createCardField({
        target: cardFieldRef.current,
        locale: sdkLocale,
        // Why: by default the iframe inputs ship with a small line-height
        // that leaves "Numărul cardului / LL/AA / CVV" hugging the top of
        // each cell. Match the rest of the form (16px / 1.45 line-height,
        // Jost) and add a touch of vertical padding so the placeholder sits
        // centered against our 52px outer cardField.
        styles: {
          default: {
            fontFamily: 'Jost, system-ui, sans-serif',
            fontSize: '16px',
            lineHeight: '1.45',
            color: '#1a1d24',
            padding: '6px 0',
          },
        },
        onSuccess: () => {
          setCardSubmitting(false);
          const id = cardOrderId.current;
          if (id) {
            clearCartRef.current();
            onSuccessRef.current(id);
          }
        },
        onError: (err) => {
          setCardSubmitting(false);
          onErrorRef.current(err?.message || t('errors.cardFailed'));
        },
        onValidation: (errors) => {
          const msgs = errors?.map((e) => e.message).filter(Boolean).join(' · ');
          if (msgs) onErrorRef.current(msgs);
        },
      });
      if (sessionSeq !== cardInitSeq.current) {
        field.destroy?.();
        return;
      }
      cardFieldInst.current = field;
      setCardSessionKey(sessionKey);
      setCardState('ready');
    } catch (err) {
      console.error('Card field init failed:', err);
      cardOrderId.current = null;
      setCardSessionKey(null);
      setCardState('idle');
      setCardSubmitting(false);
    }
  }, [createOrderApi, paymentContextKey, sdkLocale, t]);

  // Tear down card field on component unmount
  useEffect(() => {
    return () => {
      cardInitSeq.current += 1;
      destroyCardField();
      cardOrderId.current = null;
    };
  }, []);

  function handleCardSubmit() {
    if (!cardFieldInst.current || !shippingValidRef.current || cardState !== 'ready') {
      onErrorRef.current(t('errors.completeAddressAndWait'));
      return;
    }
    setCardSubmitting(true);
    // Only include billingAddress if we have a postcode — the SDK requires it.
    // When omitted, the card iframe collects the postcode from the customer.
    const billingAddress = shipping.postalCode?.trim()
      ? {
          countryCode: countryCodeFor(shipping.country),
          city: shipping.city,
          region: shipping.county,
          streetLine1: shipping.address,
          postcode: shipping.postalCode.trim(),
        }
      : undefined;
    cardFieldInst.current.submit({
      name: `${shipping.firstName} ${shipping.lastName}`.trim(),
      email: shipping.email,
      phone: shipping.phone,
      ...(billingAddress ? { billingAddress } : {}),
    });
  }

  if (!PUBLIC_KEY) {
    return (
      <div className={styles.notConfigured}>
        {t('notConfigured')} <code>NEXT_PUBLIC_REVOLUT_PUBLIC_KEY</code>.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {shippingValid ? (
        <div className={styles.walletsRow}>
          <div ref={revolutPayRef} className={styles.walletSlot} data-testid="wallet-revolut-pay" />
          <div
            ref={paymentRequestRef}
            className={styles.walletSlot}
            style={{ display: walletAvailable ? 'block' : 'none' }}
            data-testid="wallet-payment-request"
          />
        </div>
      ) : (
        <div className={styles.walletNotice}>
          {t('walletNotice')}
        </div>
      )}

      <div className={styles.divider}><span>{t('dividerOrCard')}</span></div>

      <div className={styles.cardSection}>
        <div
          ref={cardFieldRef}
          className={styles.cardField}
          style={{ display: cardState === 'ready' ? 'block' : 'none' }}
        />
        <p className={styles.cardHint}>
          {!shippingValid
            ? t('cardHintNoShipping')
            : cardState === 'ready'
              ? t('cardHintReady')
              : cardState === 'preparing'
                ? t('cardHintPreparing')
                : t('cardHintIdle')}
        </p>
        {/* Idle: customer hasn't asked for a card session yet — show an explicit
            CTA so we don't mint a pending_payment order doc on render. The
            previous behavior was an auto-prepare effect that POSTed to
            /api/payments/revolut/create-order whenever shippingValid flipped
            true; that produced phantom orders for everyone who reached the
            payment step but ultimately paid ramburs (or abandoned). */}
        {shippingValid && cardState === 'idle' && (
          <button
            type="button"
            className={styles.cardSubmitBtn}
            onClick={() => { void prepareCardSession(); }}
            disabled={cardSubmitting}
            data-testid="checkout-pay-card"
          >
            <svg
              className={styles.cardSubmitLock}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>{t('payCard', { total: formatMoney(totals.total, market.currency, locale) })}</span>
          </button>
        )}
        {cardState === 'ready' && (
          <button
            type="button"
            className={styles.cardSubmitBtn}
            onClick={handleCardSubmit}
            disabled={cardSubmitting || !shippingValid}
            data-testid="checkout-pay-card-submit"
          >
            <svg
              className={styles.cardSubmitLock}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>
              {cardSubmitting ? t('processing') : t('payCard', { total: formatMoney(totals.total, market.currency, locale) })}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function makeWalletCustomer(shipping: ShippingData) {
  const address = makeWalletAddress(shipping);

  return {
    name: `${shipping.firstName} ${shipping.lastName}`.trim(),
    email: shipping.email,
    phone: shipping.phone,
    ...(address ? { billingAddress: address, shippingAddress: address } : {}),
  };
}

function makeWalletAddress(shipping: ShippingData) {
  const postcode = shipping.postalCode?.trim();
  if (!postcode) return null;

  return {
    countryCode: countryCodeFor(shipping.country),
    city: shipping.city,
    region: shipping.county,
    streetLine1: shipping.address,
    postcode,
  };
}

function makePaymentContextKey(shipping: ShippingData, items: OrderItem[]): string {
  return JSON.stringify({
    shipping: {
      firstName: shipping.firstName,
      lastName: shipping.lastName,
      email: shipping.email,
      phone: shipping.phone,
      county: shipping.county,
      city: shipping.city,
      address: shipping.address,
      country: shipping.country,
      postalCode: shipping.postalCode,
    },
    items: items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: getLineItemUnitPrice(item),
    })),
  });
}

// ISO 3166-1 alpha-2 from a free-form country name. We only ship to RO today,
// so default to RO and add a couple of common neighbours.
type CountryCode2 = 'RO' | 'MD' | 'HU' | 'BG' | 'GB' | 'DE' | 'FR' | 'IT' | 'ES';
function countryCodeFor(name: string): CountryCode2 {
  const n = name.trim().toLowerCase();
  if (n.startsWith('rom')) return 'RO';
  if (n.startsWith('mold')) return 'MD';
  if (n.startsWith('hung')) return 'HU';
  if (n.startsWith('bulg')) return 'BG';
  if (n === 'uk' || n.startsWith('united king')) return 'GB';
  if (n.startsWith('germ')) return 'DE';
  if (n.startsWith('fran')) return 'FR';
  if (n.startsWith('italy') || n.startsWith('ita')) return 'IT';
  if (n.startsWith('span')) return 'ES';
  return 'RO';
}
