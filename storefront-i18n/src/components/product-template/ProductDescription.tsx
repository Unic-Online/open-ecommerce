import type { ProductDescriptionSection } from '@/lib/product';
import ProductImageSlot from './ProductImageSlot';
import ProductRichText from './ProductRichText';
import ProductFaq from './ProductFaq';
import styles from './product.module.css';

/**
 * Renders a single content section. Shared by the always-visible intro and the
 * collapsible accordion panels so both stay in sync. `heading` sections are
 * intentionally not handled here — they are consumed as accordion panel titles
 * by the grouping step below.
 */
function renderSection(section: ProductDescriptionSection, idx: number) {
  switch (section.kind) {
    case 'paragraph':
      return (
        <p key={idx} className={section.lead ? styles.lead : styles.body}>
          <ProductRichText text={section.body} />
        </p>
      );
    case 'heading':
      return (
        <h3 key={idx} className={styles.h3}>
          {section.text}
        </h3>
      );
    case 'subheading':
      return (
        <h4 key={idx} className={styles.h4}>
          {section.text}
        </h4>
      );
    case 'bulletList':
      return (
        <ul key={idx} className={styles.bullets}>
          {section.items.map((item) => (
            <li key={item.title}>
              <strong className={styles.bulletTitle}>{item.title}.</strong>{' '}
              {item.description}
            </li>
          ))}
        </ul>
      );
    case 'faqList':
      // FAQ is pulled out of the accordion and rendered as its own page
      // section (see ProductPage). This branch only fires if a faqList ever
      // appears outside a heading group.
      return <ProductFaq key={idx} items={section.items} />;
    case 'miniList':
      return (
        <ul key={idx} className={styles.miniList}>
          {section.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      );
    case 'specList':
      return (
        <ul key={idx} className={styles.specList}>
          {section.specs.map((s) => (
            <li key={s.label}>
              <span className={styles.specLabel}>{s.label}</span>
              <span className={styles.specValue}>{s.value}</span>
            </li>
          ))}
        </ul>
      );
    case 'image':
      return (
        <ProductImageSlot
          key={idx}
          src={section.image.src}
          label={section.image.label}
          aspect={section.image.aspect}
          priority={section.image.priority}
        />
      );
    case 'pdfDownload':
      return (
        <a
          key={idx}
          href={section.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.pdfCard}
        >
          <span className={styles.pdfIcon}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
          </span>
          <span className={styles.pdfContent}>
            <span className={styles.pdfTitle}>{section.title}</span>
            <span className={styles.pdfSub}>{section.subtitle}</span>
          </span>
          <span className={styles.pdfArrow}>→</span>
        </a>
      );
  }
}

interface AccordionGroup {
  title: string;
  sections: ProductDescriptionSection[];
}

/**
 * Splits the flat section list into a leading intro (everything before the
 * first `heading`) plus one accordion group per `heading`. Each heading's text
 * becomes the panel title and the sections that follow it — until the next
 * heading — become its body. Authoring stays a flat array; no content changes
 * are needed to get the sectioned UI.
 */
function groupSections(sections: ProductDescriptionSection[]): {
  intro: ProductDescriptionSection[];
  groups: AccordionGroup[];
} {
  const intro: ProductDescriptionSection[] = [];
  const groups: AccordionGroup[] = [];
  let current: AccordionGroup | null = null;

  for (const section of sections) {
    if (section.kind === 'heading') {
      current = { title: section.text, sections: [] };
      groups.push(current);
      continue;
    }
    if (current) {
      current.sections.push(section);
    } else {
      intro.push(section);
    }
  }

  return { intro, groups };
}

export default function ProductDescription({
  sections,
}: {
  sections: ProductDescriptionSection[];
}) {
  const { intro, groups } = groupSections(sections);
  // FAQ lives in its own standalone section (ProductPage), not in the
  // collapsible accordion — so drop any group that holds a faqList here.
  const accordionGroups = groups.filter(
    (g) => !g.sections.some((s) => s.kind === 'faqList'),
  );

  return (
    <>
      {intro.map((section, idx) => renderSection(section, idx))}

      {accordionGroups.length > 0 && (
        <div className={styles.accordion}>
          {accordionGroups.map((group, gIdx) => (
            // First panel open by default so the page isn't a wall of closed
            // rows; the rest collapse the former block-of-text into sections.
            <details
              key={group.title}
              className={styles.accordionItem}
              open={gIdx === 0}
            >
              <summary className={styles.accordionHeader}>
                {/* Heading kept inside the summary so it retains its heading
                    role (SEO + the product-page composition e2e test). */}
                <h3 className={styles.accordionTitle}>{group.title}</h3>
                <svg
                  className={styles.accordionChevron}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className={styles.accordionBody}>
                {group.sections.map((section, idx) => renderSection(section, idx))}
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
