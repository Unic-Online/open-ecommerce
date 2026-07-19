'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslations } from '@/lib/strings';
import { Link } from '@/lib/nav';

type LinkHref = ComponentProps<typeof Link>['href'];
import { useCart } from '@/lib/cart-context';
import { useMarket } from '@/lib/market-context';
import { trackAddToCart } from '@/lib/analytics';
import { logProductEvent } from '@/lib/observability';
import { formatDeliveryDate, estimateNextShippingDate, STOCK_DELIVERY_BUSINESS_DAYS } from '@/lib/delivery-estimate';
import { formatMoney } from '@/lib/format';
import { categoryToCartType, getProductPrimaryDimension, type ProductTemplate } from '@/lib/product';
import { MARKET } from '@/site.config';
import type { ReviewSummary } from '@/lib/reviews';
import { Stars } from '@/components/reviews/ReviewSummary';
import styles from './product.module.css';

interface Props {
  product: ProductTemplate;
  reviewSummary?: ReviewSummary;
}

export default function ProductBuyBox({ product, reviewSummary }: Props) {
  const { addItem } = useCart();
  const t = useTranslations('product.buybox');
  const market = useMarket();
  const [qty, setQty] = useState(1);
  const [deliveryDateLabel, setDeliveryDateLabel] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  // Hide help-contact card on markets without a support agent (FR has none).
  const showHelpContact = Boolean(product.helpContact && market.contact.whatsappNumber !== '');

  const oldPrice = product.oldPrice ?? product.price;
  const savings = oldPrice - product.price;
  const discountPct = oldPrice > product.price ? Math.round((savings / oldPrice) * 100) : 0;
  const primaryDimension = getProductPrimaryDimension(product);
  const dimensionLabel = primaryDimension?.label === 'Dimensiuni complete'
    ? t('dimensionLabel')
    : primaryDimension?.label;
  const roundedAverage = reviewSummary ? Math.round(reviewSummary.average * 10) / 10 : null;

  const shareUrl = encodeURIComponent(product.shareUrl ?? '');
  const shareTitle = encodeURIComponent(product.fullTitle);

  const decreaseQty = () => setQty((q) => Math.max(1, q - 1));
  const increaseQty = () => setQty((q) => q + 1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDeliveryDateLabel(formatDeliveryDate(estimateNextShippingDate(new Date())));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleAddToCart = () => {
    const firstImage = product.gallery[0]?.src ?? '';
    const productType = categoryToCartType(product.category);
    addItem({
      id: `${productType}__${product.slug}`,
      productType,
      productName: product.fullTitle,
      shortName: product.shortName,
      slug: product.slug,
      quantity: qty,
      image: firstImage,
      unitPrice: product.price,
    });

    trackAddToCart(product.shortName, String(qty), product.price * qty, undefined, {
      contentId: `${productType}__${product.slug}`,
      currency: MARKET.currency,
    });
    logProductEvent('product_add_to_cart', {
      slug: product.slug,
      qty: String(qty),
      price: String(product.price),
      productType,
    });

    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 600);
  };

  return (
    <aside className={styles.buyBox}>
      <h1 className={styles.title}>{product.fullTitle}</h1>

      {reviewSummary && roundedAverage !== null && (
        <a
          href="#recenzii"
          className={styles.ratingRow}
          aria-label={t('ratingAria', { rating: roundedAverage.toFixed(1) })}
        >
          <Stars value={reviewSummary.average} size="sm" />
          <span className={styles.ratingValue}>{t('ratingValue', { rating: roundedAverage.toFixed(1) })}</span>
          <span className={styles.ratingCount}>{t('ratingCount', { count: reviewSummary.total })}</span>
        </a>
      )}

      <div className={styles.priceBlock} data-testid="product-price">
        <div className={styles.priceRow}>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className={styles.priceOld}>
              {formatMoney(product.oldPrice, market.currency)}
            </span>
          )}
          <span className={styles.priceNew}>
            {formatMoney(product.price, market.currency)}
          </span>
          {discountPct > 0 && (
            <span className={styles.discountBadge}>{t('discountBadge', { percent: discountPct })}</span>
          )}
          {primaryDimension && (
            <span className={styles.dimensionBadge}>{primaryDimension.value}</span>
          )}
        </div>
      </div>

      {primaryDimension && (
        <p className={styles.dimensionLine}>
          <span>{dimensionLabel}:</span> {primaryDimension.value}
        </p>
      )}

      {product.inStock && deliveryDateLabel && (
        <div className={styles.deliveryNotice}>
          <strong>{t('deliveryNotice', { date: deliveryDateLabel })}</strong>
          <span>{t('deliveryHelper', { days: STOCK_DELIVERY_BUSINESS_DAYS })}</span>
        </div>
      )}

      {product.availabilityNote && (
        <p className={styles.availability}>{product.availabilityNote}</p>
      )}

      {product.preorderNotice && (
        <div className={styles.preorderNotice}>
          <strong>{product.preorderNotice}</strong>
        </div>
      )}

      {showHelpContact && product.helpContact && (
        <aside className={styles.helpCard} aria-label={t('supportAria')}>
          <div className={styles.helpAvatarWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.helpContact.avatar}
              alt={t('supportAlt', { name: product.helpContact.name })}
              className={styles.helpAvatar}
              width={48}
              height={48}
            />
          </div>
          <p className={styles.helpText}>
            {t('helpHello')}<strong>{product.helpContact.name}</strong>{t('helpAfter')}
            <a href={`tel:${product.helpContact.phone}`} className={styles.helpLink}>
              {product.helpContact.phone}
            </a>
            {t('helpOr')}
            <a href={`mailto:${product.helpContact.email}`} className={styles.helpLink}>
              {product.helpContact.email}
            </a>
          </p>
        </aside>
      )}

      <div className={styles.cartRow}>
        <div className={styles.qtyControl}>
          <button
            type="button"
            className={styles.qtyBtn}
            aria-label={t('qtyDecrease')}
            onClick={decreaseQty}
          >
            −
          </button>
          <input
            id="qty"
            type="text"
            value={qty}
            className={styles.qtyInput}
            readOnly
          />
          <button
            type="button"
            className={styles.qtyBtn}
            aria-label={t('qtyIncrease')}
            onClick={increaseQty}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className={styles.cta}
          onClick={handleAddToCart}
          aria-busy={justAdded}
        >
          {justAdded ? t('added') : t('addToCart')}
        </button>
      </div>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />

      <div className={styles.paymentSecurity}>
        <div className={styles.paymentLabel}>
          <strong>{t('paymentSecure')}</strong>
          <span>{t('paymentVia')}</span>
        </div>
        <div className={styles.paymentLogos}>
          <i className={`fa-brands fa-apple-pay ${styles.paymentIcon}`} aria-label="Apple Pay" />
          <i className={`fa-brands fa-google-pay ${styles.paymentIcon}`} aria-label="Google Pay" />
          <i className={`fa-brands fa-cc-mastercard ${styles.paymentIcon}`} aria-label="Mastercard" />
          <i className={`fa-brands fa-cc-visa ${styles.paymentIcon}`} aria-label="VISA" />
        </div>
      </div>

      {product.categoryLink && (
        <div className={styles.categoryRow}>
          <span className={styles.categoryLabel}>{t('categoriesLabel')}</span>
          <Link
            href={product.categoryLink.href as LinkHref}
            className={styles.categoryLink}
          >
            {product.categoryLink.label}
          </Link>
        </div>
      )}

      <div className={styles.shareRow}>
        <span className={styles.shareLabel}>{t('shareLabel')}</span>
        <div className={styles.shareIcons}>
          <a
            href={`https://www.facebook.com/sharer.php?u=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shareIcon}
            aria-label={t('shareFacebook')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <a
            href={`https://wa.me/?text=${shareTitle}%20${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shareIcon}
            aria-label={t('shareWhatsapp')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
          <a
            href={`https://telegram.me/share/url?url=${shareUrl}&text=${shareTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.shareIcon}
            aria-label={t('shareTelegram')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>
          <a
            href={`mailto:?subject=${shareTitle}&body=${shareUrl}`}
            className={styles.shareIcon}
            aria-label={t('shareEmail')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
          </a>
        </div>
      </div>
    </aside>
  );
}
