import type { Metadata } from 'next';
import CategoryListingPage from '@/components/category-page/CategoryListingPage';
import { categoryListingMetadata } from '@/components/category-page/helpers';
import type { LocaleKey } from '@/i18n/locales';

export const revalidate = 3600;

type Params = { params: Promise<{ locale: LocaleKey }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return categoryListingMetadata(locale, 'outdoor');
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  return <CategoryListingPage locale={locale} category="outdoor" />;
}
