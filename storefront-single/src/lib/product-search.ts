/**
 * Pure product matcher used by the header search.
 *
 * Invariants:
 *   - Diacritic-insensitive: "noptiera", "noptieră", "nóptiéra" all match the
 *     same product. Matters for ro AND fr (à/é/ç) so users can type without
 *     accents.
 *   - Token-based AND: every whitespace-separated token in the query must hit
 *     somewhere in the product's haystack. Otherwise "oak console" would
 *     match a nightstand with the word "oak" in cross-sells.
 *   - Stable scoring: shortName/fullTitle hits score higher than tagline,
 *     which scores higher than shortDescription. Ties break on shortName
 *     alphabetically so the result list doesn't reshuffle on each keystroke.
 * Side effects: none.
 */
import type { ProductCategory } from './product';

export interface ProductSearchable {
  slug: string;
  category: ProductCategory;
  shortName: string;
  fullTitle: string;
  tagline: string;
  shortDescription: string;
}

export interface ProductSearchHit<T extends ProductSearchable = ProductSearchable> {
  product: T;
  score: number;
}

const FIELD_WEIGHTS = {
  shortName: 8,
  fullTitle: 5,
  tagline: 3,
  category: 2,
  shortDescription: 1,
} as const;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function buildHaystack(p: ProductSearchable): Record<keyof typeof FIELD_WEIGHTS, string> {
  return {
    shortName: fold(p.shortName),
    fullTitle: fold(p.fullTitle),
    tagline: fold(p.tagline),
    category: fold(p.category),
    shortDescription: fold(p.shortDescription),
  };
}

function scoreToken(token: string, haystack: Record<keyof typeof FIELD_WEIGHTS, string>): number {
  let score = 0;
  for (const field of Object.keys(FIELD_WEIGHTS) as Array<keyof typeof FIELD_WEIGHTS>) {
    if (haystack[field].includes(token)) score += FIELD_WEIGHTS[field];
  }
  return score;
}

export function searchProducts<T extends ProductSearchable>(
  products: T[],
  query: string,
  limit = 8,
): ProductSearchHit<T>[] {
  const folded = fold(query.trim());
  if (!folded) return [];

  const tokens = folded.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const hits: ProductSearchHit<T>[] = [];
  for (const product of products) {
    const haystack = buildHaystack(product);

    let total = 0;
    let allTokensHit = true;
    for (const token of tokens) {
      const tokenScore = scoreToken(token, haystack);
      if (tokenScore === 0) {
        allTokensHit = false;
        break;
      }
      total += tokenScore;
    }

    if (!allTokensHit) continue;
    hits.push({ product, score: total });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.shortName.localeCompare(b.product.shortName);
  });

  return hits.slice(0, limit);
}
