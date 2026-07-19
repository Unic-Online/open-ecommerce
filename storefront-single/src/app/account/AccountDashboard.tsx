'use client';

import { useState, type ComponentProps } from 'react';
import { useTranslations } from '@/lib/strings';
import { Link, hrefFor } from '@/lib/nav';
import { formatMoney } from '@/lib/format';
import { categoryToProductPathname } from '@/lib/product';
import { getDefinedProduct } from '@/../content/products';
import type { CurrencyCode } from '@/lib/market';
import styles from './account.module.css';

interface OrderItemSummary {
  productName: string;
  quantity: number;
}

export interface AccountOrderSummary {
  orderId: string;
  createdAt: string; // ISO
  status: string;
  fulfillmentStatus: string;
  totalPrice: number;
  currency: CurrencyCode;
  items: OrderItemSummary[];
  productSlug: string | null;
}

interface Props {
  email: string;
  profileName: string;
  orders: AccountOrderSummary[];
}

export default function AccountDashboard({ email, profileName, orders }: Props) {
  const t = useTranslations('account.dashboard');
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/account/logout', { method: 'POST' });
      window.location.href = '/';
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className={styles.page}>
      <span className={styles.eyebrow}>{t('eyebrow')}</span>
      <h1 className={styles.title}>{t('title')}</h1>
      <p className={styles.subtitle}>{t('subtitle')}</p>

      <section className={styles.card} aria-labelledby="account-profile-heading">
        <div className={styles.profileRow}>
          <div>
            <h2 id="account-profile-heading" className={styles.profileName}>
              {profileName || t('hello')}
            </h2>
            <p className={styles.email}>{email}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span className={styles.loggedInBadge}>{t('loggedIn')}</span>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? t('loggingOut') : t('logout')}
            </button>
          </div>
        </div>
      </section>

      <h2 className={styles.sectionTitle}>{t('ordersHeading')}</h2>

      {orders.length === 0 ? (
        <div className={styles.card}>
          <p className={styles.empty}>{t('emptyOrders')}</p>
        </div>
      ) : (
        orders.map((order) => (
          <OrderCard key={order.orderId} order={order} />
        ))
      )}
    </div>
  );
}

interface OrderCardProps {
  order: AccountOrderSummary;
}

function OrderCard({ order }: OrderCardProps) {
  const t = useTranslations('account.dashboard');

  const statusClassMap: Record<string, string> = {
    received: styles.statusReceived,
    paid: styles.statusPaid,
    pending_payment: styles.statusPendingPayment,
    cancelled: styles.statusCancelled,
    failed: styles.statusFailed,
    refunded: styles.statusRefunded,
  };
  const statusClass = statusClassMap[order.status] ?? styles.statusReceived;

  const dateLabel = new Date(order.createdAt).toLocaleDateString(
    'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );

  // Resolve the localized product-detail route from the slug (the order doc
  // only stores the slug, not its category).
  const reviewProduct = order.productSlug ? getDefinedProduct(order.productSlug) : null;
  const canReview = order.fulfillmentStatus === 'delivered' && reviewProduct;

  return (
    <article className={`${styles.card} ${styles.orderCard}`} aria-label={`Order ${order.orderId}`}>
      <div className={styles.orderHeaderRow}>
        <span className={styles.orderId}>#{order.orderId}</span>
        <span className={styles.orderDate}>{dateLabel}</span>
      </div>
      <span className={`${styles.orderStatusBadge} ${statusClass}`}>
        {t(`status.${order.status}`)}
      </span>
      <ul className={styles.orderItems}>
        {order.items.map((item, i) => (
          <li key={i}>
            {item.quantity} × {item.productName}
          </li>
        ))}
      </ul>
      <div className={styles.orderTotal}>
        {t('totalLabel')}: {formatMoney(order.totalPrice, order.currency)}
      </div>
      <div className={styles.orderActions}>
        <Link
          href={hrefFor({ pathname: '/order-confirmation/[orderId]', params: { orderId: order.orderId } })}
          className={styles.actionLink}
        >
          {t('viewOrder')}
        </Link>
        {canReview ? (
          <Link
            href={{
              pathname: categoryToProductPathname(reviewProduct.category),
              params: { slug: reviewProduct.slug },
            } as unknown as ComponentProps<typeof Link>['href']}
            className={`${styles.actionLink} ${styles.actionPrimary}`}
          >
            {t('leaveReview')}
          </Link>
        ) : (
          <button
            type="button"
            className={`${styles.actionLink} ${styles.actionLinkDisabled}`}
            disabled
            title={t('reviewAfterDelivery')}
          >
            {t('leaveReview')}
          </button>
        )}
      </div>
    </article>
  );
}
