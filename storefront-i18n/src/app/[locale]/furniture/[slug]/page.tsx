import type { Metadata } from 'next';
import CategoryProductPage from '@/components/category-page/CategoryProductPage';
import { categoryProductMetadata, categorySlugParams } from '@/components/category-page/helpers';
import type { LocaleKey } from '@/i18n/locales';

export const revalidate = 3600;

type Params = { params: Promise<{ locale: LocaleKey; slug: string }> };

export function generateStaticParams() {
  return categorySlugParams('furniture');
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  return categoryProductMetadata(locale, 'furniture', slug);
}

export default async function Page({ params }: Params) {
  const { locale, slug } = await params;
  return <CategoryProductPage locale={locale} category="furniture" slug={slug} />;
}
