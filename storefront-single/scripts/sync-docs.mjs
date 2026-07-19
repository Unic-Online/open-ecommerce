#!/usr/bin/env node
/**
 * sync-docs — verify derived docs stay in sync with the code.
 *
 * Template-local, dependency-free. Two responsibilities:
 *
 *   1. ENV COVERAGE (the gate). Scans `src/` for every `process.env.X`
 *      reference and asserts that `.env.example` documents each one. The
 *      curated `.env.example` is grouped/commented by hand, so this script
 *      NEVER overwrites it — it fails with a diff when a var is missing (or
 *      stale) so a human keeps the file readable.
 *   2. ROUTE LIST (informational). Prints the App Router route table derived
 *      from `src/app/**` so you can paste/update a route section by hand if
 *      you keep one. Not asserted — purely a convenience dump.
 *
 * Usage:
 *   node scripts/sync-docs.mjs            # report + exit 1 on env drift
 *   node scripts/sync-docs.mjs --check    # same; explicit CI alias
 *   node scripts/sync-docs.mjs --routes   # also print the route list
 *
 * Exit code: 0 when `.env.example` covers every `process.env.X` in `src/`;
 *            1 on any drift (missing or undocumented vars).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(APP, 'src');
const ENV_EXAMPLE = join(APP, '.env.example');

const PRINT_ROUTES = process.argv.includes('--routes');

// Platform vars read directly (not routed through src/env.ts, by design) plus
// NODE_ENV. These are intentionally NOT documented in .env.example.
const IGNORED_ENV = new Set([
  'NODE_ENV',
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_REF',
  'VERCEL_REQUEST_ID',
  'NEXT_RUNTIME',
]);

// ─── Walk src/ ──────────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.next')) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk(SRC);

// ─── 1. Env coverage ────────────────────────────────────────────────────────

const usedEnv = new Map(); // name -> sorted [relative files]
const envRe = /process\.env\.([A-Z_][A-Z0-9_]*)/g;

for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  let m;
  while ((m = envRe.exec(txt)) !== null) {
    const name = m[1];
    if (IGNORED_ENV.has(name)) continue;
    const arr = usedEnv.get(name) ?? [];
    const rel = relative(APP, f);
    if (!arr.includes(rel)) arr.push(rel);
    usedEnv.set(name, arr);
  }
}

if (!existsSync(ENV_EXAMPLE)) {
  console.error(`error: ${relative(APP, ENV_EXAMPLE)} not found.`);
  process.exit(1);
}

// A var is "documented" if a `NAME=` line (any leading whitespace) exists.
const envText = readFileSync(ENV_EXAMPLE, 'utf8');
const documented = new Set();
const docRe = /^\s*([A-Z_][A-Z0-9_]*)=/gm;
let dm;
while ((dm = docRe.exec(envText)) !== null) documented.add(dm[1]);

const usedNames = [...usedEnv.keys()].sort();
const missing = usedNames.filter((n) => !documented.has(n));

// Stale = documented but no longer referenced anywhere in src/. Reported as a
// warning, not a failure (some vars are read only by scripts/ or e2e webServer).
const stale = [...documented].filter((n) => !usedEnv.has(n) && !IGNORED_ENV.has(n)).sort();

console.log(`env coverage: ${usedNames.length} vars referenced in src/, ${documented.size} documented in .env.example`);

if (stale.length) {
  console.warn('\n⚠  documented in .env.example but not referenced in src/ (ok if read by scripts/e2e):');
  for (const n of stale) console.warn(`   • ${n}`);
}

if (missing.length) {
  console.error('\n❌ env drift: these process.env vars are used in src/ but missing from .env.example:');
  for (const n of missing) {
    console.error(`   • ${n}  (used in: ${usedEnv.get(n).join(', ')})`);
  }
  console.error('\nAdd them to .env.example (it is curated by hand — keep the grouping/comments) and re-run.');
}

// ─── 2. Route list (informational) ──────────────────────────────────────────

if (PRINT_ROUTES) {
  function routeForFile(file) {
    const rel = relative(join(SRC, 'app'), file).replace(/\\/g, '/');
    if (rel.endsWith('page.tsx')) {
      const route = '/' + rel.replace(/\/?page\.tsx$/, '');
      return { kind: 'page', route: route === '/' ? '/' : route, file: 'src/app/' + rel };
    }
    if (rel.endsWith('route.ts')) {
      return { kind: 'api', route: '/' + rel.replace(/\/route\.ts$/, ''), file: 'src/app/' + rel };
    }
    return null;
  }

  function methodsFor(file) {
    try {
      const txt = readFileSync(join(APP, file), 'utf8');
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) =>
        new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(txt),
      );
      return methods.length ? methods.join('|') : '?';
    } catch {
      return '?';
    }
  }

  const routes = files
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => f.includes('/app/') && (f.endsWith('/page.tsx') || f.endsWith('/route.ts')))
    .map(routeForFile)
    .filter(Boolean)
    .sort((a, b) => a.route.localeCompare(b.route));

  console.log('\nApp Router routes (src/app/**):');
  for (const r of routes) {
    const label = r.kind === 'api' ? `${methodsFor(r.file)} ${r.route}` : r.route;
    console.log(`  ${label}\t${r.file}`);
  }
}

// ─── Exit ───────────────────────────────────────────────────────────────────

if (missing.length) process.exit(1);
console.log('\n✓ .env.example covers every process.env.X referenced in src/.');
