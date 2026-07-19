import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { findOrderById, updateOrderPayment } from '@/lib/contacts';
import { retrieveRevolutOrder, type RevolutOrderState } from '@/lib/revolut';
import { getMarketForLocale, MARKETS } from '@/i18n/market-config';
import type { LocaleKey } from '@/i18n/locales';
import OrderConfirmationClientCleanup from '@/components/OrderConfirmationClientCleanup';
import OrderConfirmationPurchaseTracker from '@/components/OrderConfirmationPurchaseTracker';
import OrderConfirmationStatusPoller from '@/components/OrderConfirmationStatusPoller';
import styles from './confirmare.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string; locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.confirmare' });
  return { title: t('title'), robots: 'noindex' };
}

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orderId: string; locale: LocaleKey }>;
}

type DisplayStatus =
  | 'received'
  | 'paid'
  | 'pending_payment'
  | 'cancelled'
  | 'failed'
  | 'refunded'
  | 'unknown';

function statusForRevolutState(
  state: RevolutOrderState,
): Exclude<DisplayStatus, 'unknown' | 'received' | 'refunded'> {
  if (state === 'completed') return 'paid';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'failed') return 'failed';
  return 'pending_payment';
}

interface PurchaseTrackingData {
  contentIds: string[];
  numItems: number;
  value: number;
  currency?: string;
  shipping?: number;
  items?: Array<{ id: string; name?: string; price?: number; quantity?: number }>;
}

// Shape the order doc's items/totals into the browser Purchase payload —
// identical ids/value/currency to what checkout's firePurchase sends, so the
// wallet-return path emits the same event the normal flow would have. The
// per-line items (name, unit price, quantity) and shipping feed the GA4
// `purchase` mirror; Meta keeps using the flat contentIds.
function purchaseDataFromOrder(
  order: NonNullable<Awaited<ReturnType<typeof findOrderById>>>,
): PurchaseTrackingData | null {
  const items = Array.isArray(order.items) ? order.items : [];
  const contentIds: string[] = [];
  const lineItems: NonNullable<PurchaseTrackingData['items']> = [];
  let numItems = 0;
  for (const item of items) {
    const record = item as {
      id?: unknown;
      quantity?: unknown;
      unitPrice?: unknown;
      shortName?: unknown;
      productName?: unknown;
    };
    if (typeof record?.id === 'string' && record.id) {
      contentIds.push(record.id);
      const name =
        typeof record.shortName === 'string'
          ? record.shortName
          : typeof record.productName === 'string'
            ? record.productName
            : undefined;
      lineItems.push({
        id: record.id,
        ...(name ? { name } : {}),
        ...(typeof record.unitPrice === 'number' ? { price: record.unitPrice } : {}),
        ...(typeof record.quantity === 'number' ? { quantity: record.quantity } : {}),
      });
    }
    if (typeof record?.quantity === 'number') numItems += record.quantity;
  }
  const value = typeof order.totalPrice === 'number' ? order.totalPrice : null;
  if (contentIds.length === 0 || value === null) return null;

  const currency =
    typeof order.currency === 'string'
      ? order.currency
      : typeof order.payment?.currency === 'string'
        ? order.payment.currency
        : undefined;
  const orderRecord = order as { shippingCost?: unknown };
  const shipping =
    typeof orderRecord.shippingCost === 'number' ? orderRecord.shippingCost : undefined;
  return { contentIds, numItems, value, currency, shipping, items: lineItems };
}

async function loadOrderStatus(orderId: string): Promise<{
  status: DisplayStatus;
  paymentMethod?: 'ramburs' | 'card';
  purchase?: PurchaseTrackingData;
}> {
  let order: Awaited<ReturnType<typeof findOrderById>>;
  try {
    order = await findOrderById(orderId);
  } catch (err) {
    console.error('confirmare: failed to read order:', err);
    return { status: 'unknown' };
  }
  if (!order) return { status: 'unknown' };

  const paymentMethod = order.paymentMethod as 'ramburs' | 'card' | undefined;
  const currentStatus = order.status as DisplayStatus | undefined;
  const purchase = purchaseDataFromOrder(order) ?? undefined;

  // For card orders still pending, ask Revolut for the latest state — the
  // browser redirect can beat the webhook by a few seconds.
  if (paymentMethod === 'card' && currentStatus === 'pending_payment') {
    const providerOrderId = order.payment?.providerOrderId as string | undefined;
    if (providerOrderId) {
      try {
        const revolut = await retrieveRevolutOrder(providerOrderId);
        const refreshed = statusForRevolutState(revolut.state);
        if (refreshed !== 'pending_payment') {
          await updateOrderPayment(orderId, refreshed, {
            state: revolut.state,
            paidAt: refreshed === 'paid' ? new Date() : undefined,
          });
        }
        return { status: refreshed, paymentMethod, purchase };
      } catch (err) {
        console.error('confirmare: Revolut retrieve failed:', err);
      }
    }
  }

  return { status: currentStatus ?? 'unknown', paymentMethod, purchase };
}

export default async function ConfirmarePage({ params }: PageProps) {
  const { orderId, locale } = await params;
  const { status, paymentMethod, purchase } = await loadOrderStatus(orderId);
  const showPolling = status === 'pending_payment' && paymentMethod === 'card';
  const shouldClearCheckoutState = status === 'paid' || status === 'received';
  // Browser Purchase pixel for paid orders that bypassed checkout's
  // handlePaymentSuccess (mobile wallet returns). trackPurchaseOnce gates on
  // the per-order marker + consent; Meta dedups eventID=orderId regardless.
  const showPurchaseTracker = status === 'paid' && purchase !== undefined;

  // Market-aware copy: titles/subtitles/bullets come from messages
  // (`common.confirmare`), the cash-on-delivery hint only renders on markets
  // that offer it, and the WhatsApp block only on markets with a support
  // agent (see MARKETS[*].contact — the demo config has none).
  const marketConfig = MARKETS[getMarketForLocale(locale)];
  const t = await getTranslations({ locale, namespace: 'common.confirmare' });
  const email = marketConfig.contact.businessEmail;
  const rambursAllowed = marketConfig.checkout.paymentMethods.includes('ramburs');
  const whatsappNumber = marketConfig.contact.whatsappNumber;

  const infoTitle = t('infoTitle');
  let icon = '✓';
  let title = t('default.title');
  let subtitle = t('default.subtitle');
  let infoLines: string[];

  if (status === 'paid') {
    icon = '✓';
    title = t('paid.title');
    subtitle = t('paid.subtitle');
    infoLines = [t('paid.line1'), t('paid.line2'), t('paid.line3'), t('paid.line4')];
  } else if (status === 'pending_payment') {
    icon = '⏳';
    title = t('pending.title');
    subtitle = t('pending.subtitle');
    infoLines = [t('pending.line1'), t('pending.line2'), t('pending.line3', { email })];
  } else if (status === 'cancelled') {
    icon = '✕';
    title = t('cancelled.title');
    subtitle = t('cancelled.subtitle');
    infoLines = [t('cancelled.line1'), t('cancelled.line2')];
  } else if (status === 'failed') {
    icon = '✕';
    title = t('failed.title');
    subtitle = t('failed.subtitle');
    infoLines = [t('failed.line1'), ...(rambursAllowed ? [t('failed.lineRamburs')] : [])];
  } else if (status === 'refunded') {
    icon = '↩';
    title = t('refunded.title');
    subtitle = t('refunded.subtitle');
    infoLines = [t('refunded.line1'), t('refunded.line2', { email })];
  } else if (status === 'received') {
    infoLines = [t('received.line1'), t('received.line2'), t('received.line3'), t('received.line4')];
  } else {
    infoLines = [t('unknown.line1'), t('unknown.line2', { email })];
  }

  return (
    <div className={styles.page}>
      {showPolling && <OrderConfirmationStatusPoller />}
      {showPurchaseTracker && (
        <OrderConfirmationPurchaseTracker
          orderId={orderId}
          contentIds={purchase.contentIds}
          numItems={purchase.numItems}
          value={purchase.value}
          currency={purchase.currency}
          shipping={purchase.shipping}
          items={purchase.items}
          market={getMarketForLocale(locale)}
        />
      )}
      <OrderConfirmationClientCleanup shouldClearCheckoutState={shouldClearCheckoutState} />
      <div className="container">
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <span className={styles.icon}>{icon}</span>
          </div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.orderIdBox}>
            <span className={styles.orderIdLabel}>{t('orderNumberLabel')}</span>
            <span className={styles.orderId}>#{orderId.toUpperCase()}</span>
          </div>

          <div className={styles.infoBox}>
            <h3 className={styles.infoTitle}>{infoTitle}</h3>
            <ul className={styles.infoList}>
              {infoLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>

          <div className={styles.actions}>
            <Link href="/account" className="btn btn-primary">
              {t('actions.viewOrders')}
            </Link>
            <Link href={'/furniture' as never} className="btn btn-secondary">
              {t('actions.moreProducts')}
            </Link>
            <Link href="/" className="btn btn-secondary">
              {t('actions.backHome')}
            </Link>
          </div>

          {whatsappNumber && (
            <p className={styles.contact}>
              {t('contact.prompt')}{' '}
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.waLink}
              >
                {t('contact.linkLabel')}
              </a>{' '}
              {t('contact.suffix')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
