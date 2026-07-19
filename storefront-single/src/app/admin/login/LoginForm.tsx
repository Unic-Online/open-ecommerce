'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../Admin.module.css';

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(
          json.reason === 'not-configured'
            ? 'Admin login is not configured.'
            : 'Invalid password.',
        );
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.loginCard} onSubmit={onSubmit}>
      <div className={styles.loginBrand}>
        <span className={styles.brandName}>Acme Store</span>
        <span className={styles.brandTag}>Admin</span>
      </div>
      <h1>Admin sign-in</h1>
      <p>Enter the admin password to access the dashboard.</p>
      <input
        type="password"
        autoComplete="current-password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        required
      />
      {error && <p className={styles.loginError}>{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
