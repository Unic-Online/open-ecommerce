/**
 * Sanity guard for the localized message tree.
 *
 * Goals:
 *   - every key present in `messages/ro/*.json` MUST exist in `messages/en/*.json`
 *   - no EN value may be the empty string (catches placeholder-only translations)
 *   - both files must parse as valid JSON
 *
 * Adding a new key in RO without an EN translation will fail this test —
 * intentional, so the EN market never silently falls back.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const NAMESPACES = [
  'common',
  'navigation',
  'cart',
  'checkout',
  'payment',
  'validation',
  'reviews',
  'footer',
  'popup',
  'product',
  'home',
] as const;

const ROOT = path.resolve(__dirname, '../../messages');

function loadJson(file: string): unknown {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function flattenKeys(obj: unknown, prefix = ''): Array<[string, unknown]> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return [[prefix, obj]];
  }
  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    entries.push(...flattenKeys(value, next));
  }
  return entries;
}

describe('i18n message tree', () => {
  for (const ns of NAMESPACES) {
    it(`${ns}.json: RO and EN are valid JSON`, () => {
      const ro = loadJson(path.join(ROOT, 'ro', `${ns}.json`));
      const en = loadJson(path.join(ROOT, 'en', `${ns}.json`));
      expect(ro).toBeTypeOf('object');
      expect(en).toBeTypeOf('object');
    });

    it(`${ns}.json: every RO key has a matching EN key`, () => {
      const ro = loadJson(path.join(ROOT, 'ro', `${ns}.json`));
      const en = loadJson(path.join(ROOT, 'en', `${ns}.json`));
      const roKeys = flattenKeys(ro).map(([k]) => k);
      const enKeys = new Set(flattenKeys(en).map(([k]) => k));
      const missing = roKeys.filter((k) => !enKeys.has(k));
      expect(missing).toEqual([]);
    });

    it(`${ns}.json: no EN value is empty`, () => {
      const en = loadJson(path.join(ROOT, 'en', `${ns}.json`));
      const empties = flattenKeys(en)
        .filter(([, v]) => typeof v === 'string' && v.trim() === '')
        .map(([k]) => k);
      expect(empties).toEqual([]);
    });
  }
});
