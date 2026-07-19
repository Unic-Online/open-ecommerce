export type ReviewSentiment = 'positive' | 'mixed' | 'negative';

export interface ReviewPhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ReviewVariant {
  color?: string;
  size?: string;
  quantity?: string;
}

export interface Review {
  id: string;
  name: string;
  location: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  text: string;
  date: string;
  product: string;
  variant?: ReviewVariant;
  verifiedPurchase?: boolean;
  photos?: ReviewPhoto[];
  helpfulCount?: number;
  topics?: string[];
}
