'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useCart } from '@/lib/cart-context';
import { useMarket } from '@/i18n/market-context';
import type { LocaleKey } from '@/i18n/locales';
import {
  enrichPixelWithEmail,
  getMetaTestEventCode,
  getMetaTrackingPayload,
  trackAddPaymentInfo,
  trackCartInitiateCheckoutOnce,
  trackPurchaseOnce,
} from '@/lib/analytics';
import { hasMarketingConsent } from '@/lib/consent';
import { formatMoney } from '@/lib/format';
import { getStoredEmail, isValidEmail, storeEmail } from '@/lib/email-capture';
import {
  getCheckoutExperimentAssignment,
  resolveCheckoutPaymentVariantFromBrowser,
  writeCheckoutPaymentVariantCookie,
  type CheckoutPaymentVariant,
} from '@/lib/ab-testing';
import { CART_COOKIE_NAME } from '@/plugins/abandoned-cart/shared/types';
import {
  persistCheckoutShippingDraft,
  readCheckoutShippingDraft,
} from '@/lib/checkout-shipping-draft';
import {
  getLineItemAltText,
  getLineItemTotal,
  getLineItemVariantSummary,
} from '@/lib/line-items';
import { computeOrderTotal, WELCOME_DISCOUNT, WELCOME_DISCOUNT_PERCENT } from '@/lib/pricing';
import { getShippingSchema } from '@/lib/validation';
import { RevolutPaymentWidgets } from '@/components/RevolutPaymentWidgets';
import TrustBadges from '@/components/TrustBadges';
import CheckoutContactSync from '@/plugins/abandoned-cart/client/CheckoutContactSync';
import { clearAppliedCoupon, readAppliedCoupon, type AppliedCoupon } from '@/lib/applied-coupon';
import styles from './checkout.module.css';

interface ShippingForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  county: string;
  city: string;
  address: string;
  country: string;
  postalCode: string;
  billingType: 'individual' | 'company';
  companyName: string;
  companyCui: string;
  companyRegCom: string;
  useAltShipping: boolean;
  altAddress: string;
  altCity: string;
  altCounty: string;
  altPostalCode: string;
  altCountry: string;
}

/** Maps ISO country codes used in market-config to the human-readable name
 *  shown in the checkout form. Extend when new markets launch. */
const COUNTRY_DISPLAY: Record<string, string> = {
  RO: 'România',
  FR: 'France',
};

function buildInitialForm(defaultCountryCode: string): ShippingForm {
  const countryName = COUNTRY_DISPLAY[defaultCountryCode] ?? defaultCountryCode;
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    county: '',
    city: '',
    address: '',
    country: countryName,
    postalCode: '',
    billingType: 'individual',
    companyName: '',
    companyCui: '',
    companyRegCom: '',
    useAltShipping: false,
    altAddress: '',
    altCity: '',
    altCounty: '',
    altPostalCode: '',
    altCountry: countryName,
  };
}

type FormErrors = { [K in keyof ShippingForm]?: string };

type CheckoutStep = 'email' | 'shipping' | 'payment';
type SelectedPaymentMethod = 'card' | 'ramburs';

interface CheckoutPageProps {
  forcedCheckoutPaymentVariant?: CheckoutPaymentVariant;
}

function readCartIdCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(
    new RegExp(
      '(?:^|;\\s*)' + CART_COOKIE_NAME.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '=([^;]+)',
    ),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export default function CheckoutPage({ forcedCheckoutPaymentVariant }: CheckoutPageProps = {}) {
  const { items, totalItems, totalPrice, clearCart } = useCart();
  const router = useRouter();
  const t = useTranslations('checkout');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');
  const market = useMarket();
  const locale = useLocale() as LocaleKey;
  const fmt = (amount: number) => formatMoney(amount, market.currency, locale);
  // Some markets (e.g. FR) are card-only — don't surface the ramburs option.
  const rambursAllowed = market.checkout.paymentMethods.includes('ramburs');
  const initialForm = useMemo(() => buildInitialForm(market.shipping.defaultCountryCode), [market]);
  const [form, setForm] = useState<ShippingForm>(initialForm);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [rambursSubmitting, setRambursSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [step, setStep] = useState<CheckoutStep>('email');
  const [emailStepError, setEmailStepError] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [checkoutPaymentVariant, setCheckoutPaymentVariant] = useState<CheckoutPaymentVariant>(
    forcedCheckoutPaymentVariant ?? 'control',
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<SelectedPaymentMethod>('card');
  const paymentInfoTrackedKeysRef = useRef<Set<string>>(new Set());

  const localizedShippingSchema = useMemo(
    () => getShippingSchema((key) => tValidation(key)),
    [tValidation],
  );

  const errors = useMemo<FormErrors>(() => {
    const result = localizedShippingSchema.safeParse(form);
    if (result.success) return {};
    const out: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field !== 'string') continue;
      const key = field as keyof ShippingForm;
      if (!out[key]) {
        out[key] = issue.message;
      }
    }
    return out;
  }, [form, localizedShippingSchema]);
  const shippingValid = Object.keys(errors).length === 0;
  const visibleErrors: FormErrors = showErrors ? errors : {};

  // Why: when the shipping form collapses into a summary card and the payment
  // box mounts below it, the layout jump is large enough to disorient the
  // user. Scroll the payment box into view + focus its container so the next
  // tap target is obvious and screen readers announce the new section.
  const paymentBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== 'payment') return;
    const el = paymentBoxRef.current;
    if (!el) return;
    // jsdom does not implement scrollIntoView; guard so the unit tests stay green.
    el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }, [step]);

  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  useEffect(() => {
    setCoupon(readAppliedCoupon());
  }, []);

  // The coupon is email-locked server-side: redeemCoupon({code, email})
  // only matches when the shipping email equals the coupon's email
  // (lowercased + trimmed). If the user types a different address the
  // server silently drops the discount, so we mirror that gate in the UI
  // — no point showing -10% if they're going to be charged the default
  // 20% rate.
  const formEmailNorm = form.email.trim().toLowerCase();
  const couponEmailNorm = coupon?.email?.trim().toLowerCase() ?? '';
  const couponApplies = Boolean(
    coupon && formEmailNorm.length > 0 && couponEmailNorm.length > 0 &&
      formEmailNorm === couponEmailNorm,
  );
  // True only when there's a coupon, the user has typed something, and
  // it doesn't match — gates the soft warning copy.
  const couponEmailMismatch = Boolean(
    coupon && couponEmailNorm.length > 0 && formEmailNorm.length > 0 &&
      formEmailNorm !== couponEmailNorm,
  );

  const totals = useMemo(
    () => computeOrderTotal(items, {
      couponDiscountPercent: couponApplies ? coupon?.discountPercent : undefined,
      // Why: see comanda/page.tsx — without this the displayed total
      // showed RO shipping (29) on FR while /api/order charged the FR
      // amount (10).
      shipping: market.shipping,
    }),
    [items, couponApplies, coupon, market.shipping],
  );
  const welcomeDiscount = useMemo(
    () => Math.round(totals.subtotal * WELCOME_DISCOUNT),
    [totals.subtotal],
  );
  const couponDiscount = Math.max(0, totals.discount - welcomeDiscount);
  const shippingDisplay = totals.shippingCost === 0
    ? t('summary.shippingFree')
    : fmt(totals.shippingCost);
  const checkoutExperiments = useMemo(
    () => getCheckoutExperimentAssignment(checkoutPaymentVariant),
    [checkoutPaymentVariant],
  );

  useEffect(() => {
    if (forcedCheckoutPaymentVariant) {
      writeCheckoutPaymentVariantCookie(forcedCheckoutPaymentVariant);
      setCheckoutPaymentVariant(forcedCheckoutPaymentVariant);
      return;
    }
    setCheckoutPaymentVariant(resolveCheckoutPaymentVariantFromBrowser());
  }, [forcedCheckoutPaymentVariant]);

  function firePurchase(orderId: string) {
    // Once-guarded (localStorage marker per orderId): the confirmation page
    // fires the same event for paid orders that arrive without passing
    // through here (mobile wallet returns). Meta dedups by eventID anyway —
    // the marker just avoids the redundant send.
    trackPurchaseOnce({
      orderId,
      contentIds: items.map((i) => i.id),
      numItems: totalItems,
      value: totals.total,
      currency: market.currency,
      checkoutPaymentUi: checkoutPaymentVariant,
      shipping: totals.shippingCost,
      market: market.key,
      items: items.map((i) => ({
        id: i.id,
        name: i.shortName,
        price: i.unitPrice,
        quantity: i.quantity,
      })),
    })
  }

  // Fire InitiateCheckout for direct navigations (recovery links, bookmarks,
  // FloatingCartBar → /checkout) — the sidebar path already fired and marked
  // the same cart signature, so the shared guard prevents a double fire.
  // Waits for cart hydration: the effect re-runs until items arrive, then
  // fires exactly once per mount via the ref.
  const initiateCheckoutFiredRef = useRef(false);
  useEffect(() => {
    if (initiateCheckoutFiredRef.current || items.length === 0) return;
    initiateCheckoutFiredRef.current = true;
    trackCartInitiateCheckoutOnce({
      contentIds: items.map((i) => i.id),
      numItems: totalItems,
      value: totals.total,
      currency: market.currency,
      market: market.key,
      items: items.map((i) => ({
        id: i.id,
        name: i.shortName,
        price: i.unitPrice,
        quantity: i.quantity,
      })),
    });
  }, [items, totalItems, totals.total, market.currency, market.key]);

  useEffect(() => {
    if (step !== 'payment' || items.length === 0) return;
    const trackingKey = `${checkoutPaymentVariant}:${selectedPaymentMethod}`;
    if (paymentInfoTrackedKeysRef.current.has(trackingKey)) return;
    paymentInfoTrackedKeysRef.current.add(trackingKey);

    trackAddPaymentInfo({
      contentIds: items.map((i) => i.id),
      numItems: totalItems,
      value: totals.total,
      currency: market.currency,
      paymentMethod: selectedPaymentMethod,
      checkoutPaymentUi: checkoutPaymentVariant,
      market: market.key,
      items: items.map((i) => ({
        id: i.id,
        name: i.shortName,
        price: i.unitPrice,
        quantity: i.quantity,
      })),
    });
  }, [
    checkoutPaymentVariant,
    items,
    selectedPaymentMethod,
    step,
    totalItems,
    totals.total,
    market.currency,
    market.key,
  ]);

  // Restore a saved checkout draft first, then fall back to the captured email.
  // If we already have a valid email (draft or welcome popup), skip the
  // email-only step and go straight to shipping — it would be friction to
  // ask returning users for an email we already have.
  useEffect(() => {
    const draft = readCheckoutShippingDraft();
    const stored = getStoredEmail();
    const seedEmail =
      typeof draft.email === 'string' && draft.email.trim()
        ? draft.email
        : (stored ?? '');
    setForm((prev) => ({
      ...prev,
      ...draft,
      email: seedEmail || prev.email,
    }));
    setDraftHydrated(true);
    if (isValidEmail(seedEmail)) {
      setStep('shipping');
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    persistCheckoutShippingDraft(form);
  }, [draftHydrated, form]);

  function update<K extends keyof ShippingForm>(field: K, value: ShippingForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmitEmail() {
    const trimmed = form.email.trim();
    if (!isValidEmail(trimmed)) {
      setEmailStepError(t('errors.invalidEmail'));
      return;
    }
    setEmailStepError('');
    setEmailSubmitting(true);
    storeEmail(trimmed);
    // Persist email to the cart doc immediately so abandoned-cart recovery
    // has the address even if the user never reaches the shipping form.
    // CheckoutContactSync will continue to mirror later edits, but this
    // synchronous call covers the user who bounces in the next 800 ms.
    try {
      await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: readCartIdCookie(),
          items,
          subtotal: totalPrice,
          email: trimmed,
          marketingConsent: hasMarketingConsent(),
        }),
      });
    } catch {
      // Network blip — CheckoutContactSync will retry on the next field change.
    } finally {
      setEmailSubmitting(false);
    }
    // Re-init the Pixel with email advanced matching so all subsequent
    // browser-side events on the checkout funnel carry hashed `em`. The
    // CAPI mirror already enriches via `getStoredEmail()` in sendServerEvent.
    enrichPixelWithEmail(trimmed);
    setStep('shipping');
  }

  function handleEditEmail() {
    setStep('email');
    setSubmitError('');
  }

  function handleContinueToPayment() {
    if (!shippingValid) {
      setShowErrors(true);
      return;
    }
    setSubmitError('');
    setShowErrors(false);
    setStep('payment');
  }

  function handleEditShipping() {
    setStep('shipping');
    setSubmitError('');
  }

  function handlePaymentSuccess(orderId: string) {
    clearAppliedCoupon();
    firePurchase(orderId)
    router.push({ pathname: '/confirmare/[orderId]', params: { orderId } });
  }

  function handleWidgetError(msg: string) {
    setSubmitError(msg);
    setShowErrors(true);
  }

  async function handleRamburs() {
    if (!shippingValid) {
      setShowErrors(true);
      setSubmitError(t('errors.verifyShipping'));
      return;
    }
    setSubmitError('');
    setRambursSubmitting(true);
    try {
      const marketingConsent = hasMarketingConsent();
      const testEventCode = getMetaTestEventCode();
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping: form,
          items,
          paymentMethod: 'ramburs',
          marketingConsent,
          ...(marketingConsent ? { tracking: getMetaTrackingPayload() } : {}),
          ...(couponApplies && coupon?.code ? { couponCode: coupon.code } : {}),
          experiments: checkoutExperiments,
          // Forward active Meta Test Events session so the server-side
          // Purchase CAPI fires with the right test_event_code instead of
          // silently landing in the production stream.
          ...(testEventCode ? { testEventCode } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('errors.orderProcessing'));

      firePurchase(data.orderId)

      clearAppliedCoupon();
      clearCart();
      router.push({ pathname: '/confirmare/[orderId]', params: { orderId: data.orderId } });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setRambursSubmitting(false);
    }
  }

  // Market gate — when checkout is disabled for this market (FR until
  // Phase 7), render the "coming soon" notice instead of the form. The
  // server-side guard in /api/order is the actual safety net; this is the
  // user-facing fallback so the FR storefront never reaches the payment
  // widgets.
  if (!market.checkout.enabled) {
    return (
      <div className={styles.emptyWrap}>
        <div className="container">
          <div className={styles.emptyInner}>
            <h1>{t('unavailable.title')}</h1>
            <p>{t('unavailable.body')}</p>
            <Link href="/" className="btn btn-primary">
              {t('unavailable.cta')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !rambursSubmitting) {
    return (
      <div className={styles.emptyWrap}>
        <div className="container">
          <div className={styles.emptyInner}>
            <h1>{t('emptyCart.title')}</h1>
            <p>{t('emptyCart.hint')}</p>
            <Link href="/" className="btn btn-primary">
              {tCommon('actions.backToProducts')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Mirror checkout email/phone to the cart doc as the user types so
          the abandoned-cart recovery has contact info even if the user
          bounces before the payment step. Renders nothing. */}
      <CheckoutContactSync email={form.email} phone={form.phone} />
      <div className="container">
        <h1 className={styles.pageTitle}>{t('pageTitle')}</h1>

        <div className={styles.layout}>
          <div className={styles.formSection}>
            {step === 'email' && (
              <>
                <div className={styles.stepHeader}>
                  <span className={styles.stepBadge}>1</span>
                  <h2 className={styles.sectionTitle}>{t('steps.email')}</h2>
                </div>
                <p className={styles.emailIntro}>
                  {t('emailIntro')}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmitEmail();
                  }}
                  noValidate
                  autoComplete="on"
                  name="emailOnly"
                >
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email-only">{t('fields.emailRequired')}</label>
                    <input
                      id="email-only"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className={`${styles.input} ${emailStepError ? styles.inputError : ''}`}
                      value={form.email}
                      onChange={(e) => {
                        update('email', e.target.value);
                        if (emailStepError) setEmailStepError('');
                      }}
                      placeholder={t('fields.emailPlaceholder')}
                      autoFocus
                    />
                    {emailStepError && <span className={styles.error}>{emailStepError}</span>}
                  </div>
                  <button
                    type="submit"
                    className={styles.continueBtn}
                    disabled={emailSubmitting}
                    data-testid="checkout-email-continue"
                  >
                    {emailSubmitting ? t('actions.savingEmail') : t('actions.continueEmail')}
                  </button>
                </form>
              </>
            )}

            {step !== 'email' && (
              <div className={styles.shippingSummary}>
                <div className={styles.shippingSummaryHead}>
                  <div className={styles.stepHeader}>
                    <span className={`${styles.stepBadge} ${styles.stepBadgeDone}`}>✓</span>
                    <h2 className={styles.sectionTitle}>{t('steps.emailDone')}</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.editLink}
                    onClick={handleEditEmail}
                    data-testid="checkout-email-edit"
                  >
                    {t('edit')}
                  </button>
                </div>
                <div className={styles.shippingSummaryBody}>
                  <p className={styles.shippingSummaryLine}>{form.email}</p>
                </div>
              </div>
            )}

            {step === 'shipping' && (
              <>
                <div className={styles.stepHeader}>
                  <span className={styles.stepBadge}>2</span>
                  <h2 className={styles.sectionTitle}>{t('steps.shipping')}</h2>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleContinueToPayment();
                  }}
                  noValidate
                  autoComplete="on"
                  name="shipping"
                >
                  <fieldset className={styles.billingFieldset}>
                    <legend className={styles.fieldsetLegend}>{t('fields.billingType')}</legend>
                    <div className={styles.optionGroup}>
                      <label
                        className={`${styles.optionCard} ${form.billingType === 'individual' ? styles.optionCardActive : ''}`}
                      >
                        <input
                          type="radio"
                          name="billingType"
                          value="individual"
                          checked={form.billingType === 'individual'}
                          onChange={() => update('billingType', 'individual')}
                          className={styles.optionRadio}
                        />
                        <span className={styles.optionLabel}>{t('fields.individual')}</span>
                      </label>
                      <label
                        className={`${styles.optionCard} ${form.billingType === 'company' ? styles.optionCardActive : ''}`}
                      >
                        <input
                          type="radio"
                          name="billingType"
                          value="company"
                          checked={form.billingType === 'company'}
                          onChange={() => update('billingType', 'company')}
                          className={styles.optionRadio}
                        />
                        <span className={styles.optionLabel}>{t('fields.company')}</span>
                      </label>
                    </div>
                  </fieldset>

                  {form.billingType === 'company' && (
                    <div className={styles.companyFields}>
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="company-name">{t('fields.companyName')}</label>
                        <input
                          id="company-name"
                          name="organization"
                          autoComplete="organization"
                          className={`${styles.input} ${visibleErrors.companyName ? styles.inputError : ''}`}
                          value={form.companyName}
                          onChange={(e) => update('companyName', e.target.value)}
                          placeholder={t('fields.companyNamePlaceholder')}
                        />
                        {visibleErrors.companyName && <span className={styles.error}>{visibleErrors.companyName}</span>}
                      </div>
                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="company-cui">{t('fields.companyCui')}</label>
                          <input
                            id="company-cui"
                            name="companyCui"
                            className={`${styles.input} ${visibleErrors.companyCui ? styles.inputError : ''}`}
                            value={form.companyCui}
                            onChange={(e) => update('companyCui', e.target.value)}
                            placeholder={t('fields.companyCuiPlaceholder')}
                          />
                          {visibleErrors.companyCui && <span className={styles.error}>{visibleErrors.companyCui}</span>}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="company-regcom">{t('fields.companyRegCom')}</label>
                          <input
                            id="company-regcom"
                            name="companyRegCom"
                            className={`${styles.input} ${visibleErrors.companyRegCom ? styles.inputError : ''}`}
                            value={form.companyRegCom}
                            onChange={(e) => update('companyRegCom', e.target.value)}
                            placeholder={t('fields.companyRegComPlaceholder')}
                          />
                          {visibleErrors.companyRegCom && <span className={styles.error}>{visibleErrors.companyRegCom}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="ship-firstName">{t('fields.firstName')}</label>
                      <input
                        id="ship-firstName"
                        name="firstName"
                        autoComplete="given-name"
                        className={`${styles.input} ${visibleErrors.firstName ? styles.inputError : ''}`}
                        value={form.firstName}
                        onChange={(e) => update('firstName', e.target.value)}
                        placeholder={t('fields.firstNamePlaceholder')}
                      />
                      {visibleErrors.firstName && <span className={styles.error}>{visibleErrors.firstName}</span>}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="ship-lastName">{t('fields.lastName')}</label>
                      <input
                        id="ship-lastName"
                        name="lastName"
                        autoComplete="family-name"
                        className={`${styles.input} ${visibleErrors.lastName ? styles.inputError : ''}`}
                        value={form.lastName}
                        onChange={(e) => update('lastName', e.target.value)}
                        placeholder={t('fields.lastNamePlaceholder')}
                      />
                      {visibleErrors.lastName && <span className={styles.error}>{visibleErrors.lastName}</span>}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="ship-phone">{t('fields.phone')}</label>
                    <input
                      id="ship-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      className={`${styles.input} ${visibleErrors.phone ? styles.inputError : ''}`}
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder={t('fields.phonePlaceholder')}
                    />
                    {visibleErrors.phone && <span className={styles.error}>{visibleErrors.phone}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="ship-address">{t('fields.address')}</label>
                    <input
                      id="ship-address"
                      name="address"
                      autoComplete="street-address"
                      className={`${styles.input} ${visibleErrors.address ? styles.inputError : ''}`}
                      value={form.address}
                      onChange={(e) => update('address', e.target.value)}
                      placeholder={t('fields.addressPlaceholder')}
                    />
                    {visibleErrors.address && <span className={styles.error}>{visibleErrors.address}</span>}
                  </div>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="ship-city">{t('fields.city')}</label>
                      <input
                        id="ship-city"
                        name="city"
                        autoComplete="address-level2"
                        className={`${styles.input} ${visibleErrors.city ? styles.inputError : ''}`}
                        value={form.city}
                        onChange={(e) => update('city', e.target.value)}
                        placeholder={t('fields.cityPlaceholder')}
                      />
                      {visibleErrors.city && <span className={styles.error}>{visibleErrors.city}</span>}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="ship-county">{t('fields.county')}</label>
                      <input
                        id="ship-county"
                        name="county"
                        autoComplete="address-level1"
                        className={`${styles.input} ${visibleErrors.county ? styles.inputError : ''}`}
                        value={form.county}
                        onChange={(e) => update('county', e.target.value)}
                        placeholder={t('fields.countyPlaceholder')}
                      />
                      {visibleErrors.county && <span className={styles.error}>{visibleErrors.county}</span>}
                    </div>
                  </div>

                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="ship-country">{t('fields.country')}</label>
                      <input
                        id="ship-country"
                        name="country"
                        autoComplete="country-name"
                        className={`${styles.input} ${visibleErrors.country ? styles.inputError : ''}`}
                        value={form.country}
                        onChange={(e) => update('country', e.target.value)}
                      />
                      {visibleErrors.country && <span className={styles.error}>{visibleErrors.country}</span>}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="ship-postalCode">{t('fields.postalCode')}</label>
                      <input
                        id="ship-postalCode"
                        name="postalCode"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        className={`${styles.input} ${visibleErrors.postalCode ? styles.inputError : ''}`}
                        value={form.postalCode}
                        onChange={(e) => update('postalCode', e.target.value)}
                        placeholder={t('fields.postalCodePlaceholder')}
                      />
                      {visibleErrors.postalCode && <span className={styles.error}>{visibleErrors.postalCode}</span>}
                    </div>
                  </div>

                  <label className={styles.altShippingToggle}>
                    <input
                      type="checkbox"
                      checked={form.useAltShipping}
                      onChange={(e) => update('useAltShipping', e.target.checked)}
                      className={styles.altShippingCheckbox}
                    />
                    <span>{t('fields.useAltShipping')}</span>
                  </label>

                  {form.useAltShipping && (
                    <div className={styles.altShippingFields}>
                      <h3 className={styles.altShippingTitle}>{t('fields.altAddressTitle')}</h3>
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="alt-address">{t('fields.address')}</label>
                        <input
                          id="alt-address"
                          name="altAddress"
                          autoComplete="shipping street-address"
                          className={`${styles.input} ${visibleErrors.altAddress ? styles.inputError : ''}`}
                          value={form.altAddress}
                          onChange={(e) => update('altAddress', e.target.value)}
                          placeholder={t('fields.altAddressPlaceholder')}
                        />
                        {visibleErrors.altAddress && <span className={styles.error}>{visibleErrors.altAddress}</span>}
                      </div>
                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="alt-city">{t('fields.city')}</label>
                          <input
                            id="alt-city"
                            name="altCity"
                            autoComplete="shipping address-level2"
                            className={`${styles.input} ${visibleErrors.altCity ? styles.inputError : ''}`}
                            value={form.altCity}
                            onChange={(e) => update('altCity', e.target.value)}
                            placeholder={t('fields.cityPlaceholder')}
                          />
                          {visibleErrors.altCity && <span className={styles.error}>{visibleErrors.altCity}</span>}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="alt-county">{t('fields.county')}</label>
                          <input
                            id="alt-county"
                            name="altCounty"
                            autoComplete="shipping address-level1"
                            className={`${styles.input} ${visibleErrors.altCounty ? styles.inputError : ''}`}
                            value={form.altCounty}
                            onChange={(e) => update('altCounty', e.target.value)}
                            placeholder={t('fields.countyPlaceholder')}
                          />
                          {visibleErrors.altCounty && <span className={styles.error}>{visibleErrors.altCounty}</span>}
                        </div>
                      </div>
                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="alt-country">{t('fields.country')}</label>
                          <input
                            id="alt-country"
                            name="altCountry"
                            autoComplete="shipping country-name"
                            className={`${styles.input} ${visibleErrors.altCountry ? styles.inputError : ''}`}
                            value={form.altCountry}
                            onChange={(e) => update('altCountry', e.target.value)}
                          />
                          {visibleErrors.altCountry && <span className={styles.error}>{visibleErrors.altCountry}</span>}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="alt-postalCode">{t('fields.postalCode')}</label>
                          <input
                            id="alt-postalCode"
                            name="altPostalCode"
                            autoComplete="shipping postal-code"
                            inputMode="numeric"
                            className={`${styles.input} ${visibleErrors.altPostalCode ? styles.inputError : ''}`}
                            value={form.altPostalCode}
                            onChange={(e) => update('altPostalCode', e.target.value)}
                            placeholder={t('fields.postalCodePlaceholder')}
                          />
                          {visibleErrors.altPostalCode && <span className={styles.error}>{visibleErrors.altPostalCode}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className={styles.continueBtn}
                    data-testid="checkout-continue-payment"
                  >
                    {t('actions.continueToPayment')}
                  </button>
                </form>
              </>
            )}

            {step === 'payment' && (
              <div className={styles.shippingSummary}>
                <div className={styles.shippingSummaryHead}>
                  <div className={styles.stepHeader}>
                    <span className={`${styles.stepBadge} ${styles.stepBadgeDone}`}>✓</span>
                    <h2 className={styles.sectionTitle}>{t('steps.shipping')}</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.editLink}
                    onClick={handleEditShipping}
                    data-testid="checkout-shipping-edit"
                  >
                    {t('editShipping')}
                  </button>
                </div>
                <div className={styles.shippingSummaryBody}>
                  <p className={styles.shippingSummaryName}>
                    {form.firstName} {form.lastName}
                    {form.billingType === 'company' && form.companyName ? ` · ${form.companyName}` : ''}
                  </p>
                  <p className={styles.shippingSummaryLine}>{form.phone}</p>
                  <p className={styles.shippingSummaryLine}>
                    {form.address}, {form.city}, {form.county}
                    {form.postalCode ? `, ${form.postalCode}` : ''}, {form.country}
                  </p>
                  {form.billingType === 'company' && (
                    <p className={styles.shippingSummaryLine}>
                      {t('summary.shippingSummaryCompany', { cui: form.companyCui, regcom: form.companyRegCom })}
                    </p>
                  )}
                  {form.useAltShipping && (
                    <p className={styles.shippingSummaryLine}>
                      <strong>{t('summary.shippingSummaryDeliverTo')}</strong> {form.altAddress}, {form.altCity}, {form.altCounty}
                      {form.altPostalCode ? `, ${form.altPostalCode}` : ''}, {form.altCountry}
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 'payment' && (
              <div
                ref={paymentBoxRef}
                tabIndex={-1}
                className={styles.paymentBox}
              >
                <div className={styles.stepHeader}>
                  <span className={styles.stepBadge}>3</span>
                  <h2 className={styles.sectionTitle}>{t('steps.payment')}</h2>
                </div>

                <TrustBadges />

                {/* Compact bullet list is the default everywhere now (#14).
                    Customer picks card vs ramburs explicitly; nothing fires
                    server-side until they click. The previous "control" UI
                    auto-mounted Revolut widgets, which auto-prepared a card
                    session and minted phantom pending_payment orders. */}
                {rambursAllowed && (
                  <fieldset className={styles.compactPaymentFieldset}>
                    <legend className={styles.paymentTitle}>{t('payment.selectMethod')}</legend>
                    <div className={styles.compactPaymentOptions}>
                      <label
                        className={`${styles.compactPaymentOption} ${
                          selectedPaymentMethod === 'card' ? styles.compactPaymentOptionActive : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="card"
                          checked={selectedPaymentMethod === 'card'}
                          onChange={() => setSelectedPaymentMethod('card')}
                          className={styles.compactPaymentRadio}
                          data-testid="checkout-pay-method-card"
                        />
                        <span className={styles.compactPaymentContent}>
                          <span className={styles.compactPaymentTitleRow}>
                            <span className={styles.compactPaymentName}>{t('payment.online')}</span>
                            <span className={styles.compactPaymentMeta}>{t('payment.onlineMeta')}</span>
                          </span>
                          <span className={styles.compactPaymentPrice}>{fmt(totals.total)}</span>
                        </span>
                      </label>

                      <label
                        className={`${styles.compactPaymentOption} ${
                          selectedPaymentMethod === 'ramburs' ? styles.compactPaymentOptionActive : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="ramburs"
                          checked={selectedPaymentMethod === 'ramburs'}
                          onChange={() => setSelectedPaymentMethod('ramburs')}
                          className={styles.compactPaymentRadio}
                          data-testid="checkout-pay-method-ramburs"
                        />
                        <span className={styles.compactPaymentContent}>
                          <span className={styles.compactPaymentTitleRow}>
                            <span className={styles.compactPaymentName}>{t('payment.ramburs')}</span>
                            <span className={styles.compactPaymentMeta}>{t('payment.rambursMeta')}</span>
                          </span>
                          <span className={styles.compactPaymentPrice}>{fmt(totals.total)}</span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                )}

                {selectedPaymentMethod === 'card' ? (
                  <div className={styles.compactPaymentAction}>
                    <RevolutPaymentWidgets
                      shipping={form}
                      shippingValid={shippingValid}
                      items={items}
                      couponCode={couponApplies ? coupon?.code : undefined}
                      couponDiscountPercent={couponApplies ? coupon?.discountPercent : undefined}
                      experiments={checkoutExperiments}
                      onSuccess={handlePaymentSuccess}
                      onError={handleWidgetError}
                    />
                  </div>
                ) : (
                  <div className={styles.compactPaymentAction}>
                    <button
                      type="button"
                      className={`${styles.rambursBtn} ${styles.compactRambursBtn}`}
                      onClick={handleRamburs}
                      disabled={rambursSubmitting}
                      data-testid="checkout-confirm-ramburs"
                    >
                      {rambursSubmitting
                        ? t('actions.processing')
                        : t('actions.confirmRamburs', { total: fmt(totals.total) })}
                    </button>
                    <p className={styles.compactPaymentNote}>
                      {t('payment.rambursNote')}
                    </p>
                  </div>
                )}

                {submitError && <div className={styles.submitError}>{submitError}</div>}
              </div>
            )}
          </div>

          {/* Order summary */}
          <div className={styles.summary}>
            <h2 className={styles.sectionTitle}>{t('summary.title')}</h2>
            <div className={styles.summaryItems}>
              {items.map((item) => (
                <div key={item.id} className={styles.summaryItem}>
                  <div className={styles.summaryItemImage}>
                    <Image src={item.image} alt={getLineItemAltText(item)} width={60} height={45} quality={80} />
                  </div>
                  <div className={styles.summaryItemInfo}>
                    <p className={styles.summaryItemName}>{item.productName}</p>
                    <p className={styles.summaryItemVariant}>
                      {getLineItemVariantSummary(item)}
                    </p>
                    <p className={styles.summaryItemQty}>×{item.quantity}</p>
                  </div>
                  <span className={styles.summaryItemPrice}>{fmt(getLineItemTotal(item))}</span>
                </div>
              ))}
            </div>
            <div className={styles.summaryTotals}>
              <div className={styles.summaryRow}>
                <span>{t('summary.subtotal')}</span>
                <span className={styles.summaryStrike}>{fmt(totals.subtotal)}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>{t('summary.welcomeDiscount', { percent: WELCOME_DISCOUNT_PERCENT })}</span>
                <span className={styles.discountValue}>-{fmt(welcomeDiscount)}</span>
              </div>
              {coupon && couponApplies && couponDiscount > 0 && (
                <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                  <span>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '0.62rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#1a8a4a',
                        background: 'rgba(26, 138, 74, 0.12)',
                        padding: '0.16rem 0.5rem',
                        borderRadius: '999px',
                        marginRight: '0.5rem',
                        verticalAlign: 'middle',
                        fontWeight: 700,
                      }}
                    >
                      {t('summary.couponBadge')}
                    </span>
                    <strong style={{ fontFamily: 'SF Mono, Menlo, monospace' }}>
                      {coupon.code}
                    </strong>{' '}
                    (-{coupon.discountPercent}%)
                  </span>
                  <span className={styles.discountValue}>-{fmt(couponDiscount)}</span>
                </div>
              )}
              {couponEmailMismatch && (
                <div
                  className={styles.summaryRow}
                  style={{
                    fontSize: '0.78rem',
                    color: '#b85c00',
                    background: '#fff7e6',
                    border: '1px solid #f3d77a',
                    borderRadius: 8,
                    padding: '0.5rem 0.7rem',
                    lineHeight: 1.45,
                    display: 'block',
                  }}
                >
                  {t.rich('summary.couponMismatch', {
                    code: coupon?.code ?? '',
                    email: coupon?.email ?? '',
                    percent: coupon?.discountPercent ?? 0,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </div>
              )}
              <div className={styles.summaryRow}>
                <span>{t('summary.shipping')} {totals.shippingCost > 0 ? t('summary.shippingFreeNote', { amount: fmt(market.shipping.freeThreshold) }) : ''}</span>
                <span className={totals.shippingCost === 0 ? styles.freeShipping : undefined}>{shippingDisplay}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>{t('summary.total')}</span>
                <span>{fmt(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
