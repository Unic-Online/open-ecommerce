/**
 * Translation shim over the single English `strings`
 * object (`src/content/strings.ts`).
 *
 * Provides `useTranslations` / `getTranslations` over the typed `strings`.
 * The template is single-language (English), so there is no locale dimension,
 * no message loading, and no provider — copy is a typed module import resolved
 * at build time.
 *
 * Supported surface (only what the codebase actually uses):
 *   - `t(key, values?)`     — dot-path lookup within the namespace, `{var}`
 *                             interpolation, and a tiny ICU `plural` resolver
 *                             (`{count, plural, one {…} other {…}}` with `#`).
 *   - `t.rich(key, tags)`   — interpolate `{var}` values AND `<tag>…</tag>`
 *                             chunk callbacks into a React fragment.
 *   - `t.raw(key)`          — return the raw value (used for arrays of objects).
 *   - `t.has(key)`          — whether the key resolves to a string.
 *
 * `useTranslations(namespace)` and the async `getTranslations` compat (accepts
 * either a string namespace or `{ namespace }`) both return the same `t`.
 *
 * Side effects: none.
 */
import React, { type ReactNode } from 'react';
import { strings } from '@/content/strings';

type Primitive = string | number | boolean | null | undefined;
type Values = Record<string, Primitive>;
type RichTag = (chunks: ReactNode) => ReactNode;
/** A `t.rich` argument map mixes value placeholders with tag callbacks. */
type RichArgs = Record<string, Primitive | RichTag>;

// Resolve a (possibly dotted) namespace + key path against the strings object.
function resolve(namespace: string, key: string): unknown {
  const fullPath = key ? `${namespace}.${key}` : namespace;
  const parts = fullPath.split('.');
  let node: unknown = strings;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

// Interpolate `{var}` placeholders, leaving ICU plural blocks for the caller.
function interpolateVars(input: string, values?: Values): string {
  if (!values) return input;
  return input.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (name in values) {
      const v = values[name];
      return v == null ? '' : String(v);
    }
    return match;
  });
}

// Minimal ICU `plural` resolver: `{count, plural, one {…} other {…}}`. `#` is
// replaced by the numeric value. Only `one`/`other` categories are used in the
// ported copy.
const PLURAL_RE = /\{(\w+),\s*plural,\s*([\s\S]*?)\}\}/;

function resolvePlurals(input: string, values?: Values): string {
  let out = input;
  let guard = 0;
  while (PLURAL_RE.test(out) && guard < 20) {
    guard++;
    out = out.replace(PLURAL_RE, (full, varName: string, body: string) => {
      const count = Number(values?.[varName] ?? 0);
      // Re-append the consumed final `}` of the inner `other {…}}` capture.
      const branchBody = body + '}';
      const branches: Record<string, string> = {};
      const branchRe = /(\w+)\s*\{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = branchRe.exec(branchBody)) !== null) {
        branches[m[1]] = m[2];
      }
      const chosen = count === 1 ? branches.one ?? branches.other ?? '' : branches.other ?? '';
      return chosen.replace(/#/g, String(count));
    });
  }
  return out;
}

function formatString(value: string, values?: Values): string {
  // ICU plural first (it references the same `#`/count), then simple {var}.
  const pluralized = resolvePlurals(value, values);
  return interpolateVars(pluralized, values);
}

export interface Translator {
  (key: string, values?: Values): string;
  rich(key: string, tags: RichArgs): ReactNode;
  raw(key: string): unknown;
  has(key: string): boolean;
}

// Parse a string into React nodes, applying `<tag>…</tag>` chunk callbacks and
// `{var}` value interpolation. Tags must be non-nested (the ported copy only
// uses single-level <strong>/<br> wrappers).
function renderRich(value: string, tags: RichArgs): ReactNode {
  // First interpolate plain values + plurals so only markup tags remain.
  const valueOnly: Values = {};
  for (const [k, v] of Object.entries(tags)) {
    if (typeof v !== 'function') valueOnly[k] = v;
  }
  const text = formatString(value, valueOnly);

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let keyCounter = 0;
  // Matches self-closing `<tag/>` or paired `<tag>inner</tag>`.
  const tagRe = /<(\w+)\s*\/>|<(\w+)>([\s\S]*?)<\/\2>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const selfClosingName = match[1];
    const pairedName = match[2];
    if (selfClosingName) {
      const fn = tags[selfClosingName];
      nodes.push(
        React.createElement(
          React.Fragment,
          { key: `r${keyCounter++}` },
          typeof fn === 'function' ? fn(null) : null,
        ),
      );
    } else {
      const fn = tags[pairedName];
      const inner = match[3];
      nodes.push(
        React.createElement(
          React.Fragment,
          { key: `r${keyCounter++}` },
          typeof fn === 'function' ? fn(inner) : inner,
        ),
      );
    }
    cursor = tagRe.lastIndex;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return React.createElement(React.Fragment, null, ...nodes);
}

function makeTranslator(namespace: string): Translator {
  const t = ((key: string, values?: Values): string => {
    const value = resolve(namespace, key);
    if (typeof value === 'string') return formatString(value, values);
    if (value == null) return key;
    return String(value);
  }) as Translator;

  t.rich = (key: string, tags: RichArgs): ReactNode => {
    const value = resolve(namespace, key);
    if (typeof value !== 'string') return key;
    return renderRich(value, tags);
  };

  t.raw = (key: string): unknown => resolve(namespace, key);

  t.has = (key: string): boolean => typeof resolve(namespace, key) === 'string';

  return t;
}

// Translators are pure (they only close over `namespace` and read the static
// `strings` module — no per-render state), so we hand out ONE stable instance
// per namespace. This keeps `t`'s identity stable across renders without a
// React hook (so it stays safe to call from server components too). Without a
// stable `t`, any useCallback/useEffect that depends on it re-runs every
// render — e.g. the Revolut wallet effect, which then re-mounts the Apple Pay
// button on every render and flickers infinitely.
const translatorCache = new Map<string, Translator>();
function getTranslator(namespace: string): Translator {
  let t = translatorCache.get(namespace);
  if (!t) {
    t = makeTranslator(namespace);
    translatorCache.set(namespace, t);
  }
  return t;
}

/** Client/server-agnostic translator factory (useTranslations shape). */
export function useTranslations(namespace: string): Translator {
  return getTranslator(namespace);
}

/**
 * Async compat mirroring the former server `getTranslations` call shape.
 * Accepts a bare namespace string or the `{ namespace }` object form; the
 * `locale` field (if present) is ignored — there is only one language.
 */
export async function getTranslations(
  arg: string | { locale?: string; namespace: string },
): Promise<Translator> {
  const namespace = typeof arg === 'string' ? arg : arg.namespace;
  return getTranslator(namespace);
}
