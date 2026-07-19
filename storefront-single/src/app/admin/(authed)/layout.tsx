import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import LogoutButton from '../LogoutButton';
import styles from '../Admin.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Acme Store — admin',
  robots: { index: false, follow: false },
};

// Layout for the auth-gated half of /admin/*. Sibling /admin/login lives
// outside this route group so the redirect-on-no-session here can't loop
// into itself.
export default async function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await requireAdmin())) {
    redirect('/admin/login');
  }

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href="/admin" className={styles.brand}>
            <span className={styles.brandName}>Acme Store</span>
            <span className={styles.brandTag}>Admin</span>
          </Link>
          <span className={styles.barSpacer} />
          <nav className={styles.navLinks} aria-label="Admin">
            <Link className={styles.navLink} href="/admin">Dashboard</Link>
            <Link className={styles.navLink} href="/admin/orders">Orders</Link>
            <Link className={styles.navLink} href="/admin/coupons">Coupons</Link>
            <Link className={styles.navLink} href="/admin/products">Top products</Link>
            <Link className={styles.navLink} href="/admin/reviews">Reviews</Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
