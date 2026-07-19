import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder } from '@/lib/orders/queries';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { OrderHeader } from './_components/OrderHeader';
import { CustomerBlock } from './_components/CustomerBlock';
import { ItemsBlock } from './_components/ItemsBlock';
import { PaymentBlock } from './_components/PaymentBlock';
import { AuditLogBlock } from './_components/AuditLogBlock';
import { NotesBlock } from './_components/NotesBlock';
import { StatusActions } from './_components/StatusActions.client';
import { NoteForm } from './_components/NoteForm.client';
import { FulfillmentEditor } from './_components/FulfillmentEditor.client';
import { ResendShipmentEmailButton } from './_components/ResendShipmentEmailButton.client';
import { RefundForm } from './_components/RefundForm.client';
import { ResendEmailButton } from './_components/ResendEmailButton.client';
import { ShippingEditor } from './_components/ShippingEditor.client';
import styles from '../../../Admin.module.css';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function AdminOrderDetail({ params }: Props) {
  const { orderId } = await params;

  if (isAbandonedCartDryRun()) {
    return (
      <div className={styles.page}>
        <Link href="/admin/orders" className={styles.backLink}>← Back</Link>
        <div className={styles.warn}>DB not configured. Order detail unavailable.</div>
      </div>
    );
  }

  const order = await getOrder(orderId);
  if (!order) notFound();

  const fulfillment = order.fulfillment;
  const fulfillmentInitial = {
    status: fulfillment?.status ?? ('unfulfilled' as const),
    carrier: fulfillment?.carrier ?? '',
    trackingNumber: fulfillment?.trackingNumber ?? '',
  };

  return (
    <div className={styles.page}>
      <Link href="/admin/orders" className={styles.backLink}>← Back to orders</Link>
      <h1 className={styles.heading}>Order #{order.orderId}</h1>

      <OrderHeader order={order} />

      <h2 className={styles.subheading}>Status</h2>
      <StatusActions orderId={order.orderId} status={order.status} />

      <h2 className={styles.subheading}>Customer & shipping</h2>
      <CustomerBlock order={order} />
      <ShippingEditor
        orderId={order.orderId}
        status={order.status}
        shipping={order.shipping}
      />

      <h2 className={styles.subheading}>Items</h2>
      <ItemsBlock order={order} />

      <h2 className={styles.subheading}>Payment</h2>
      <PaymentBlock order={order} />
      <ResendEmailButton orderId={order.orderId} />

      <h2 className={styles.subheading}>Fulfillment</h2>
      <FulfillmentEditor
        orderId={order.orderId}
        initial={fulfillmentInitial}
        shipmentEmailAlreadySent={!!fulfillment?.shipmentEmailSentAt}
      />
      {fulfillment?.status === 'shipped' && (
        <ResendShipmentEmailButton orderId={order.orderId} />
      )}
      {fulfillment?.shipmentEmailLastError && (
        <p className={`${styles.errorText} ${styles.stack}`}>
          Last shipment-email error: {fulfillment.shipmentEmailLastError}
        </p>
      )}

      <h2 className={styles.subheading}>Refund</h2>
      <RefundForm
        orderId={order.orderId}
        totalPrice={order.totalPrice}
        currency={order.currency}
        alreadyRefunded={!!order.refund}
      />

      <h2 className={styles.subheading}>Internal notes</h2>
      <NotesBlock order={order} />
      <NoteForm orderId={order.orderId} />

      <h2 className={styles.subheading}>Activity log</h2>
      <AuditLogBlock order={order} />

      <p className={`${styles.helpText} ${styles.stack}`}>
        To change items, refund and re-create the order.
      </p>
    </div>
  );
}
