import LoginForm from './LoginForm';
import styles from '../Admin.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin sign-in',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className={styles.loginShell}>
      <LoginForm />
    </div>
  );
}
