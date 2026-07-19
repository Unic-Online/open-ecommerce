/**
 * Asserts every `/images/...` path referenced from product content and
 * business stubs resolves to a real file under `public/`. The check
 * scans the source files directly (regex), so it catches every spelling:
 * `gallery[].src`, `description[{kind:'image'}].image.src`, and any other
 * literal that happens to start with `/images/`. Also covers internal
 * PDF paths (we skip absolute URLs).
 *
 * Catches a product gallery image being mis-pointed
 * at a path that has no matching file on
 * disk.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const PUBLIC_DIR = resolve(REPO_ROOT, 'public');

// Walk every TS file that owns product copy or stubs. Anything literal
// starting with `/images/` is treated as a public-asset reference. We
// purposefully avoid loading the modules — string-level extraction
// catches refs even if a file has a typo that breaks `import`.
const SOURCE_DIRS = [
  resolve(REPO_ROOT, 'content/products'),
  resolve(REPO_ROOT, 'src/data'),
];

const IMAGE_REF_RE = /["'`](\/images\/[^"'`\s]+)["'`]/g;

interface Reference {
  path: string;
  source: string;
}

function* walkTsFiles(root: string): Generator<string> {
  for (const entry of readdirSync(root)) {
    const abs = join(root, entry);
    if (statSync(abs).isDirectory()) {
      yield* walkTsFiles(abs);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      yield abs;
    }
  }
}

function collectImageReferences(): Reference[] {
  const refs: Reference[] = [];
  const seen = new Set<string>();
  for (const root of SOURCE_DIRS) {
    if (!existsSync(root)) continue;
    for (const file of walkTsFiles(root)) {
      const body = readFileSync(file, 'utf8');
      for (const m of body.matchAll(IMAGE_REF_RE)) {
        const path = m[1];
        const key = `${file}::${path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({ path, source: relative(REPO_ROOT, file) });
      }
    }
  }
  return refs;
}

describe('product image references', () => {
  const references = collectImageReferences();

  it('finds at least a handful — guard against the regex silently breaking', () => {
    expect(references.length).toBeGreaterThan(10);
  });

  it.each(references)(
    'exists on disk: $path (referenced by $source)',
    ({ path }) => {
      const abs = resolve(PUBLIC_DIR, path.replace(/^\//, ''));
      expect(existsSync(abs), `missing public asset: ${path}`).toBe(true);
    },
  );
});
