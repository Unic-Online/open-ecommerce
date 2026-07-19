'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShippingData } from '@/lib/validation';
import { TERMINAL_STATUSES, type OrderStatus } from '@/lib/orders/status-machine';
import styles from '../../../../Admin.module.css';

interface Props {
  orderId: string;
  status: OrderStatus;
  shipping: ShippingData;
}

const REASON_COPY: Record<string, string> = {
  'invalid-body': 'Some fields are invalid — see the highlighted errors.',
  'terminal-status': 'Order is in a terminal status — shipping is locked.',
  'not-found': 'Order not found.',
  'dry-run': 'MongoDB not configured.',
  unauthenticated: 'Session expired.',
  malformed: 'Bad request.',
};

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  county: string;
  city: string;
  address: string;
  country: string;
  postalCode: string;
  billingType: 'individual' | 'company';
  companyName: string;
  companyCui: string;
  companyRegCom: string;
  useAltShipping: boolean;
  altAddress: string;
  altCity: string;
  altCounty: string;
  altPostalCode: string;
  altCountry: string;
}

function toFormState(s: ShippingData): FormState {
  return {
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    phone: s.phone,
    county: s.county,
    city: s.city,
    address: s.address,
    country: s.country,
    postalCode: s.postalCode,
    billingType: s.billingType ?? 'individual',
    companyName: s.companyName ?? '',
    companyCui: s.companyCui ?? '',
    companyRegCom: s.companyRegCom ?? '',
    useAltShipping: !!s.useAltShipping,
    altAddress: s.altAddress ?? '',
    altCity: s.altCity ?? '',
    altCounty: s.altCounty ?? '',
    altPostalCode: s.altPostalCode ?? '',
    altCountry: s.altCountry ?? '',
  };
}

export function ShippingEditor({ orderId, status, shipping }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(shipping));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);

  const locked = TERMINAL_STATUSES.has(status);

  if (locked) {
    return (
      <p className={styles.helpText}>
        Order is in a terminal status — shipping is locked. Refund or re-create
        if address changes are needed.
      </p>
    );
  }

  if (!open) {
    return (
      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.pageBtn}
          onClick={() => setOpen(true)}
        >
          Edit shipping
        </button>
      </div>
    );
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setIssues([]);

    // Body shape mirrors `shippingSchema` exactly — only the company / alt
    // fields are sent when their gate is on, otherwise the fields are
    // omitted (Zod accepts undefined for optional strings).
    const body: Partial<FormState> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      county: form.county,
      city: form.city,
      address: form.address,
      country: form.country,
      postalCode: form.postalCode,
      billingType: form.billingType,
      useAltShipping: form.useAltShipping,
    };
    if (form.billingType === 'company') {
      body.companyName = form.companyName;
      body.companyCui = form.companyCui;
      body.companyRegCom = form.companyRegCom;
    }
    if (form.useAltShipping) {
      body.altAddress = form.altAddress;
      body.altCity = form.altCity;
      body.altCounty = form.altCounty;
      body.altPostalCode = form.altPostalCode;
      body.altCountry = form.altCountry;
    }

    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/shipping`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        const reason: string | undefined = json.reason;
        setError(reason ? REASON_COPY[reason] || `Failed (${reason}).` : 'Failed.');
        if (Array.isArray(json.issues)) setIssues(json.issues);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  function field(label: string, key: keyof FormState, required = false, placeholder = '') {
    const issue = issues.find((i) => i.path === key);
    return (
      <label className={`${styles.filterField} ${styles.grow}`}>
        <span className={styles.filterLabel}>
          {label}
          {required ? ' *' : ''}
        </span>
        <input
          type="text"
          value={String(form[key] ?? '')}
          onChange={(e) => set(key, e.target.value as never)}
          placeholder={placeholder}
        />
        {issue && <span className={styles.fieldError}>{issue.message}</span>}
      </label>
    );
  }

  return (
    <form onSubmit={submit} className={`${styles.filterBar} ${styles.stack}`}>
      {field('First name', 'firstName', true)}
      {field('Last name', 'lastName', true)}
      {field('Email', 'email', true)}
      {field('Phone', 'phone', true)}
      {field('Country', 'country', true)}
      {field('County', 'county', true)}
      {field('City', 'city', true)}
      {field('Address', 'address', true)}
      {field('Postal code', 'postalCode', true)}

      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Billing type</span>
        <select
          value={form.billingType}
          onChange={(e) =>
            set('billingType', e.target.value as 'individual' | 'company')
          }
        >
          <option value="individual">individual</option>
          <option value="company">company</option>
        </select>
      </label>

      {form.billingType === 'company' && (
        <>
          {field('Company name', 'companyName', true)}
          {field('CUI', 'companyCui', true)}
          {field('Reg. Com.', 'companyRegCom', true)}
        </>
      )}

      <label className={`${styles.filterField} ${styles.checkboxField}`}>
        <input
          type="checkbox"
          checked={form.useAltShipping}
          onChange={(e) => set('useAltShipping', e.target.checked)}
        />
        <span className={styles.filterLabel}>Ship to a different address</span>
      </label>

      {form.useAltShipping && (
        <>
          {field('Alt address', 'altAddress', true)}
          {field('Alt city', 'altCity', true)}
          {field('Alt county', 'altCounty', true)}
          {field('Alt postal code', 'altPostalCode', true)}
          {field('Alt country', 'altCountry', true)}
        </>
      )}

      <div className={`${styles.filterActions} ${styles.spanAll}`}>
        <button type="submit" disabled={busy} className={styles.btnPrimary}>
          {busy ? 'Saving…' : 'Save shipping'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setForm(toFormState(shipping));
            setIssues([]);
            setError('');
          }}
          className={styles.pageBtn}
        >
          Cancel
        </button>
      </div>

      {error && <div className={`${styles.spanAll} ${styles.errorText}`}>{error}</div>}
    </form>
  );
}
