import type { Metadata } from 'next';
import { getTranslations } from '@/lib/strings';
import { getMarketConfig } from '@/lib/market';
import infoStyles from '@/components/InfoPage.module.css';
import { ContactContent } from '@/../content/pages/contact';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo.contact');
  return { title: t('title'), description: t('description') };
}

export default function ContactPage() {
  const market = getMarketConfig();
  return (
    <div className={infoStyles.page}>
      <ContactContent
        businessEmail={market.contact.businessEmail}
        whatsappDisplay={market.contact.whatsappDisplay}
      />
    </div>
  );
}
