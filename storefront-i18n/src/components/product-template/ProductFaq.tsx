import type { ProductFaqItem } from '@/lib/product';
import ProductRichText from './ProductRichText';
import styles from './product.module.css';

/**
 * FAQ block — one collapsible row per question. Rendered as its own page
 * section (outside the description accordion) so the questions are always
 * reachable; each answer still expands on demand.
 */
export default function ProductFaq({ items }: { items: ProductFaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.faqList}>
      {items.map((item, i) => (
        <details key={i} className={styles.faqItem}>
          <summary className={styles.faqQuestion}>
            <span>{item.question}</span>
            <svg
              className={styles.faqIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" className={styles.faqIconV} />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </summary>
          <div className={styles.faqAnswer}>
            <ProductRichText text={item.answer} />
          </div>
        </details>
      ))}
    </div>
  );
}
