'use client';

import { useTranslations } from 'next-intl';
import { openCookieSettings } from './CookieBanner';

interface Props {
  className?: string;
  label?: string;
}

export default function CookieSettingsLink({ className, label }: Props) {
  const t = useTranslations('common.cookies');
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={className}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
    >
      {label ?? t('settingsLink')}
    </button>
  );
}
