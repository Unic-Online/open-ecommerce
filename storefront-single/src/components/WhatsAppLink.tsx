'use client';

import { trackEvent } from '@/lib/analytics';

interface WhatsAppLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  productName?: string;
}

/**
 * WhatsApp link that tracks a lead event on click
 */
export default function WhatsAppLink({
  href,
  className = '',
  children,
  productName,
}: WhatsAppLinkProps) {
  const handleClick = () => {
    trackEvent('Lead', {
      content_name: productName || 'WhatsApp Inquiry',
      content_category: 'WhatsApp Inquiry',
    });
  };

  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
