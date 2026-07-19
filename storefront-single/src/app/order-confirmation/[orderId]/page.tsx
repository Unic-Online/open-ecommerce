import type { Metadata } from 'next';
import { getTranslations } from '@/lib/strings';
import { Link } from '@/lib/nav';
import { getMarketConfig } from '@/lib/market';
import { findOrderById, updateOrderPayment } from '@/lib/contacts';
import { retrieveRevolutOrder, type RevolutOrderState } from '@/lib/revolut';
import OrderConfirmationClientCleanup from '@/components/OrderConfirmationClientCleanup';
import OrderConfirmationPurchaseTracker from '@/components/OrderConfirmationPurchaseTracker';
import OrderConfirmationStatusPoller from '@/components/OrderConfirmationStatusPoller';
import styles from './confirmare.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo.confirmare');
  return { title: t('title'), robots: 'noindex' };
}

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orderId: string }>;
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
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const contentIds: string[] = [];
  const lineItems: NonNullable<PurchaseTrackingData['items']> = [];
  let numItems = 0;
  for (const item of rawItems) {
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
  paymentMethod?: 'cod' | 'card';
  purchase?: PurchaseTrackingData;
}> {
  let order: Awaited<ReturnType<typeof findOrderById>>;
  try {
    order = await findOrderById(orderId);
  } catch (err) {
    console.error('order-confirmation: failed to read order:', err);
    return { status: 'unknown' };
  }
  if (!order) return { status: 'unknown' };

  const paymentMethod = order.paymentMethod as 'cod' | 'card' | undefined;
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
  const { orderId } = await params;
  const { status, paymentMethod, purchase } = await loadOrderStatus(orderId);
  const businessEmail = getMarketConfig().contact.businessEmail;
  const showPolling = status === 'pending_payment' && paymentMethod === 'card';
  const shouldClearCheckoutState = status === 'paid' || status === 'received';
  // Browser Purchase pixel for paid orders that bypassed checkout's
  // handlePaymentSuccess (mobile wallet returns). trackPurchaseOnce gates on
  // the per-order marker + consent; Meta dedups eventID=orderId regardless.
  const showPurchaseTracker = status === 'paid' && purchase !== undefined;

  const infoTitle = '📦 What happens next?';
  let icon = '✓';
  let title = 'Your order has been placed!';
  let subtitle = 'Thank you for your order. You will receive a confirmation email shortly.';
  let infoLines: string[];

  if (status === 'paid') {
    icon = '✓';
    title = 'Payment successful — thank you!';
    subtitle = 'Your payment has been confirmed. We are preparing your parcel for dispatch.';
    infoLines = [
      'Automatic payment confirmation received from the processor.',
      'We will call you to confirm delivery.',
      'Dispatched by courier within 24–48 working hours.',
      'Your invoice and order details have been emailed to you.',
    ];
  } else if (status === 'pending_payment') {
    icon = '⏳';
    title = 'Checking your payment...';
    subtitle = 'Please wait a few seconds — we are confirming your payment with the processor.';
    infoLines = [
      'We refresh the payment status automatically over the next ~30 seconds.',
      'If you abandoned the payment, you can return to your basket and try again.',
      "If the payment succeeds but you don't see the confirmation, message us on WhatsApp.",
    ];
  } else if (status === 'cancelled') {
    icon = '✕';
    title = 'Payment cancelled';
    subtitle = 'Your order was not completed. You can try again at any time.';
    infoLines = ['Your parcel was not dispatched.', 'No money was taken.'];
  } else if (status === 'failed') {
    icon = '✕';
    title = 'Payment failed';
    subtitle = 'Your payment could not be processed. Please try a different payment method.';
    infoLines = ['No money was taken.', 'You can choose cash on delivery as an alternative.'];
  } else if (status === 'refunded') {
    icon = '↩';
    title = 'Your order has been refunded';
    subtitle = 'Your payment has been returned. The amount will appear in your account within a few working days.';
    infoLines = [
      'Your parcel will not be dispatched (or has already been recovered).',
      'For questions about the refund, message us on WhatsApp.',
    ];
  } else if (status === 'received') {
    infoLines = [
      'Your order has been registered and sent to our team.',
      'We will call you to confirm your order.',
      'Dispatched by courier within 24–48 working hours.',
      'Payment is made by cash on delivery, when your parcel arrives.',
    ];
  } else {
    infoLines = [
      'Your order has been registered.',
      "If you don't receive a confirmation shortly, message us on WhatsApp.",
    ];
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
            <span className={styles.orderIdLabel}>Order number</span>
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
              View my orders
            </Link>
            <Link href="/furniture" className="btn btn-secondary">
              Browse more products
            </Link>
            <Link href="/" className="btn btn-secondary">
              Back to home
            </Link>
          </div>

          <p className={styles.contact}>
            Questions? Email us at{' '}
            <a href={`mailto:${businessEmail}`} className={styles.waLink}>
              {businessEmail}
            </a>
            {' '}— we usually reply within a few hours.
          </p>
        </div>
      </div>
    </div>
  );
}
