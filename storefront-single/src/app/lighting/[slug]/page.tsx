import type { Metadata } from 'next';
import CategoryProductPage from '@/components/category-page/CategoryProductPage';
import { categoryProductMetadata, categorySlugParams } from '@/components/category-page/helpers';

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return categorySlugParams('lighting');
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return categoryProductMetadata('lighting', slug);
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  return <CategoryProductPage category="lighting" slug={slug} />;
}
