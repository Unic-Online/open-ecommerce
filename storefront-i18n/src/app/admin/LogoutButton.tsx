'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Admin.module.css';

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    if (busy) return; // guard against double-clicks firing concurrent requests
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/admin/logout', { method: 'POST' });
      if (!res.ok) throw new Error(`logout failed: ${res.status}`);
      // On success the component unmounts via navigation — leave `busy` set so
      // the button can't be re-clicked during the redirect.
      router.replace('/admin/login');
      router.refresh();
    } catch {
      // Network/5xx: surface the failure and re-enable so the operator can retry
      // instead of being silently left logged in.
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.logoutBtn}
        onClick={logout}
        disabled={busy}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {failed && (
        <span className={styles.errorText} role="alert">
          Sign-out failed — please try again.
        </span>
      )}
    </>
  );
}
