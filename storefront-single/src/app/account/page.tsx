import { Suspense } from 'react';
import { getTranslations } from '@/lib/strings';
import { notFoundUnless } from '@/lib/feature-flags';
import { features } from '@/site.config';
import { getAccountSessionEmail } from '@/lib/account-auth';
import { listOrdersForEmail } from '@/lib/account-tokens';
import type { OrderDoc } from '@/lib/orders/types';
import AccountLogin from './AccountLogin';
import AccountDashboard, { type AccountOrderSummary } from './AccountDashboard';
import styles from './account.module.css';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export const dynamic = 'force-dynamic';

function summarizeOrder(doc: OrderDoc): AccountOrderSummary {
  const firstItemSlug = (doc.items[0] as { slug?: string } | undefined)?.slug ?? null;
  return {
    orderId: doc.orderId,
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)).toISOString(),
    status: doc.status,
    fulfillmentStatus: doc.fulfillment?.status ?? 'unfulfilled',
    totalPrice: doc.totalPrice,
    currency: doc.currency,
    items: doc.items.map((item) => ({
      productName: (item as { productName?: string; shortName?: string }).productName
        ?? (item as { shortName?: string }).shortName
        ?? 'Produs',
      quantity: (item as { quantity?: number }).quantity ?? 1,
    })),
    productSlug: firstItemSlug,
  };
}

function deriveProfileName(orders: OrderDoc[]): string {
  if (orders.length === 0) return '';
  const latest = orders[0];
  return [latest.shipping.firstName, latest.shipping.lastName].filter(Boolean).join(' ');
}

export default async function AccountPage({ searchParams }: Props) {
  notFoundUnless(features.accounts);
  const t = await getTranslations('account');
  const params = await searchParams;
  const email = await getAccountSessionEmail();

  if (!email) {
    return (
      <main className={styles.page}>
        <span className={styles.eyebrow}>{t('login.eyebrow')}</span>
        <h1 className={styles.title}>{t('login.pageTitle')}</h1>
        <p className={styles.subtitle}>{t('login.pageSubtitle')}</p>
        <Suspense fallback={null}>
          <AccountLogin initialError={params.error} />
        </Suspense>
      </main>
    );
  }

  const docs = (await listOrdersForEmail(email)) as unknown as OrderDoc[];
  const orders = docs.map(summarizeOrder);
  const profileName = deriveProfileName(docs);

  return <AccountDashboard email={email} profileName={profileName} orders={orders} />;
}
