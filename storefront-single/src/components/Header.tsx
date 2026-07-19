'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from '@/lib/strings';
import { Link, usePathname, hrefFor } from '@/lib/nav';
import Image from 'next/image';
import { useMarket } from '@/lib/market-context';
import { categoryToProductPathname, categoryToProductRoute } from '@/lib/product';
import { searchProducts } from '@/lib/product-search';
import { getSearchableProducts } from '@/lib/product-search-index';
import { formatMoney } from '@/lib/format';
import { brand, categories, features } from '@/site.config';
import CartIcon from './CartIcon';
import styles from './Header.module.css';

// Category links, derived from the registry. `key` is the category key — both
// the nav label (`menuItems.<key>`) and the submenu blurb (`categoryLinks.<key>`)
// are looked up by it.
type AppPathname = string;

const CATEGORY_LINK_KEYS: Array<{ href: AppPathname; key: string }> = categories.map((cat) => ({
  href: categoryToProductRoute(cat.key),
  key: cat.key,
}));

interface MenuItem {
  labelKey: string;
  href?: string;
  externalHref?: string;
  children?: MenuItem[];
}

const MENU_ITEMS: MenuItem[] = [
  { labelKey: 'home', href: '/' },
  ...categories.map(
    (cat): MenuItem => ({
      labelKey: cat.key,
      href: categoryToProductRoute(cat.key),
    }),
  ),
  // Account entry is gated by the `accounts` feature flag.
  ...(features.accounts ? [{ labelKey: 'account', href: '/account' }] : []),
  { labelKey: 'despreNoi', href: '/despre-noi' },
  { labelKey: 'contact', href: '/contact' },
];

export default function Header() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const market = useMarket();
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopGroupOpen, setDesktopGroupOpen] = useState<string | null>(null);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);

  const allProducts = useMemo(
    () => getSearchableProducts(),
    [market.key],
  );

  const searchResults = useMemo(
    () => searchProducts(allProducts, searchQuery),
    [allProducts, searchQuery],
  );

  const fmt = useCallback(
    (amount: number) => formatMoney(amount, market.currency),
    [market.currency],
  );

  const close = useCallback(() => {
    setMenuOpen(false);
    setDesktopGroupOpen(null);
    setDesktopSearchOpen(false);
    setExpandedGroups(new Set());
    setSearchQuery('');
  }, []);

  // If already on the homepage, scroll to top instead of navigating
  const handleHomeClick = useCallback(
    (e: React.MouseEvent) => {
      if (pathname === '/') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      close();
    },
    [pathname, close],
  );

  // Prevent body scrolling when drawer is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    if (desktopSearchOpen) {
      desktopSearchInputRef.current?.focus();
    }
  }, [desktopSearchOpen]);

  const toggleDesktopGroup = (key: string) => {
    setDesktopGroupOpen((openKey) => (openKey === key ? null : key));
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSearchButtonClick = () => {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

    if (isMobile) {
      setMenuOpen(true);
      setDesktopSearchOpen(false);
      return;
    }

    setMenuOpen(false);
    setDesktopGroupOpen(null);
    setDesktopSearchOpen((open) => !open);
  };

  const renderSearchResults = (id: string) => (
    <div
      id={id}
      className={styles.searchResults}
      role="region"
      aria-label={t('search')}
    >
      {searchResults.length === 0 ? (
        <p className={styles.searchEmpty}>{t('searchNoResults')}</p>
      ) : (
        <ul className={styles.searchResultList}>
          {searchResults.map(({ product }) => (
            <li key={`${product.category}/${product.slug}`}>
              <Link
                href={hrefFor({
                  pathname: categoryToProductPathname(product.category),
                  params: { slug: product.slug },
                })}
                className={styles.searchResultLink}
                onClick={close}
              >
                {product.gallery[0]?.src ? (
                  <Image
                    src={product.gallery[0].src}
                    alt=""
                    width={48}
                    height={48}
                    className={styles.searchResultImg}
                  />
                ) : (
                  <span className={styles.searchResultImg} aria-hidden="true" />
                )}
                <span className={styles.searchResultText}>
                  <span className={styles.searchResultName}>{product.shortName}</span>
                  <span className={styles.searchResultTagline}>{product.tagline}</span>
                </span>
                <span className={styles.searchResultPrice}>{fmt(product.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo} onClick={handleHomeClick} aria-label={t('logoAria')}>
          <Image
            src={brand.logo.header}
            alt={brand.siteName}
            width={140}
            height={42}
            sizes="120px"
            className={styles.logoImg}
            priority
          />
        </Link>

        <nav id="site-navigation" className={styles.nav}>
          {MENU_ITEMS.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = desktopGroupOpen === item.labelKey;

            if (hasChildren) {
              return (
                <div key={item.labelKey} className={styles.navGroup}>
                  <button
                    type="button"
                    className={`${styles.navLink} ${styles.navButton}`}
                    aria-expanded={isExpanded}
                    aria-controls={`desktop-${item.labelKey}-menu`}
                    onClick={() => toggleDesktopGroup(item.labelKey)}
                  >
                    {t(`menuItems.${item.labelKey}`)}
                    <span className={styles.navChevron} aria-hidden="true">⌄</span>
                  </button>
                  <div
                    id={`desktop-${item.labelKey}-menu`}
                    className={`${styles.submenu} ${isExpanded ? styles.submenuOpen : ''}`}
                  >
                    {item.children!.map((child) => (
                      <Link key={child.href} href={child.href!} className={styles.submenuLink} onClick={close}>
                        <span>{t(`menuItems.${child.labelKey}`)}</span>
                        {CATEGORY_LINK_KEYS.find((category) => category.href === child.href) ? (
                          <small>
                            {t(`categoryLinks.${CATEGORY_LINK_KEYS.find((category) => category.href === child.href)!.key}.description`)}
                          </small>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            if (item.externalHref) {
              return (
                <a
                  key={item.labelKey}
                  href={item.externalHref}
                  className={styles.navLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  {t(`menuItems.${item.labelKey}`)}
                </a>
              );
            }

            return (
              <Link
                key={item.labelKey}
                href={item.href!}
                className={styles.navLink}
                onClick={item.href === '/' ? handleHomeClick : close}
              >
                {t(`menuItems.${item.labelKey}`)}
              </Link>
            );
          })}
        </nav>

        <div className={styles.headerActions}>
          {/* Search icon */}
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={handleSearchButtonClick}
            aria-label={t('search')}
            aria-controls="desktop-header-search"
            aria-expanded={desktopSearchOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          {/* User account icon — hidden when the accounts feature is off */}
          {features.accounts && (
            <Link href="/account" className={styles.headerIconBtn} aria-label={t('account')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          )}
          <CartIcon />
          <button
            className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
            aria-controls="mobile-drawer"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div
        id="desktop-header-search"
        className={`${styles.desktopSearchPanel} ${desktopSearchOpen ? styles.desktopSearchPanelOpen : ''}`}
        aria-hidden={!desktopSearchOpen}
      >
        <div className={`container ${styles.desktopSearchInner}`}>
          <div className={styles.desktopSearchCard}>
            <div className={styles.drawerSearch}>
              <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={desktopSearchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('search')}
                aria-controls="desktop-header-search-results"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setSearchQuery('')}
                  aria-label={t('searchClear')}
                >
                  ×
                </button>
              )}
            </div>
            {desktopSearchOpen && searchQuery.trim().length > 0 && renderSearchResults('desktop-header-search-results')}
          </div>
        </div>
      </div>

      {/* -------- Full-screen mobile drawer -------- */}
      <div
        id="mobile-drawer"
        className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ''}`}
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen ? true : undefined}
        aria-hidden={!menuOpen}
      >
        {/* Spacer so content sits below the fixed header bar */}
        <div className={styles.drawerSpacer} />

        {/* Search bar */}
        <div className={styles.drawerSearch}>
          <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('search')}
            aria-controls="header-search-results"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label={t('searchClear')}
            >
              ×
            </button>
          )}
        </div>

        {/* Search results — shown only when there is a query */}
        {menuOpen && searchQuery.trim().length > 0 && renderSearchResults('header-search-results')}

        {/* Menu items */}
        <ul className={styles.drawerList}>
          {MENU_ITEMS.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedGroups.has(item.labelKey);

            return (
              <li key={item.labelKey} className={styles.drawerItem}>
                {hasChildren ? (
                  <>
                    <button
                      type="button"
                      className={styles.drawerLink}
                      onClick={() => toggleGroup(item.labelKey)}
                      aria-expanded={isExpanded}
                    >
                      <span>{t(`menuItems.${item.labelKey}`)}</span>
                      <svg
                        className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <ul className={styles.subList}>
                        {item.children!.map((child) => (
                          <li key={child.labelKey}>
                            <Link
                              href={child.href!}
                              className={styles.subLink}
                              onClick={close}
                            >
                              {t(`menuItems.${child.labelKey}`)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : item.externalHref ? (
                  <a
                    href={item.externalHref}
                    className={styles.drawerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                  >
                    <span>{t(`menuItems.${item.labelKey}`)}</span>
                  </a>
                ) : (
                  <Link
                    href={item.href!}
                    className={styles.drawerLink}
                    onClick={item.href === '/' ? handleHomeClick : close}
                  >
                    <span>{t(`menuItems.${item.labelKey}`)}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {/* Social links at the bottom */}
        <div className={styles.drawerSocial}>
          <a
            href="https://www.facebook.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialIcon}
            aria-label="Facebook"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          </a>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialIcon}
            aria-label="Instagram"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </a>
          <a
            href="https://www.tiktok.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialIcon}
            aria-label="TikTok"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78 2.92 2.92 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.57 6.33 6.33 0 0 0 9.37 22a6.33 6.33 0 0 0 6.38-6.22V9.4a8.16 8.16 0 0 0 4.84 1.58V7.55a4.84 4.84 0 0 1-1-.86z"/>
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
