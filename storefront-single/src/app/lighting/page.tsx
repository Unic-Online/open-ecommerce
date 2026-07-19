import type { Metadata } from 'next';
import CategoryListingPage from '@/components/category-page/CategoryListingPage';
import { categoryListingMetadata } from '@/components/category-page/helpers';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return categoryListingMetadata('lighting');
}

export default async function Page() {
  return <CategoryListingPage category="lighting" />;
}
