#!/usr/bin/env node
/**
 * Revolut webhook helper.
 *
 *   node scripts/revolut-webhook.mjs list
 *   node scripts/revolut-webhook.mjs create <url>        # url required (your deployed origin)
 *   node scripts/revolut-webhook.mjs delete <webhook_id>
 *   node scripts/revolut-webhook.mjs rotate <webhook_id>
 *
 * Reads REVOLUT_SECRET_KEY (and optional REVOLUT_API_MODE) from `.env.local`
 * at the project root, falling back to the process environment. Prints
 * `signing_secret` on `create` / `rotate` so you can paste it straight into
 * REVOLUT_WEBHOOK_SIGNING_SECRET.
 *
 * Example:
 *   node scripts/revolut-webhook.mjs create https://shop.example.com/api/webhooks/revolut
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = join(ROOT, '.env.local');
const API_VERSION = '2026-03-12';
const DEFAULT_EVENTS = [
  'ORDER_COMPLETED',
  'ORDER_AUTHORISED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
  'ORDER_PAYMENT_DECLINED',
];

function loadEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(ENV_LOCAL), ...process.env };
const SECRET = env.REVOLUT_SECRET_KEY;
const MODE = env.REVOLUT_API_MODE === 'sandbox' ? 'sandbox' : 'live';
const BASE = MODE === 'sandbox' ? 'https://sandbox-merchant.revolut.com' : 'https://merchant.revolut.com';

if (!SECRET) {
  console.error(`error: REVOLUT_SECRET_KEY not found in ${ENV_LOCAL} or environment`);
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${SECRET}`,
  'Revolut-Api-Version': API_VERSION,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${method} ${path}`);
    console.error(json);
    process.exit(1);
  }
  return json;
}

const cmd = process.argv[2];
const arg = process.argv[3];

console.error(`(mode: ${MODE} → ${BASE})`);

switch (cmd) {
  case 'list': {
    const out = await call('GET', '/api/webhooks');
    console.log(JSON.stringify(out, null, 2));
    break;
  }
  case 'create': {
    if (!arg) {
      console.error('usage: ... create <url>   e.g. https://shop.example.com/api/webhooks/revolut');
      process.exit(1);
    }
    const out = await call('POST', '/api/webhooks', { url: arg, events: DEFAULT_EVENTS });
    console.log(JSON.stringify(out, null, 2));
    if (out && out.signing_secret) {
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`webhook id:     ${out.id}`);
      console.error(`signing_secret: ${out.signing_secret}`);
      console.error('');
      console.error('Paste into your Vercel project env (and .env.local):');
      console.error(`  REVOLUT_WEBHOOK_SIGNING_SECRET=${out.signing_secret}`);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    break;
  }
  case 'delete': {
    if (!arg) {
      console.error('usage: ... delete <webhook_id>');
      process.exit(1);
    }
    await call('DELETE', `/api/webhooks/${encodeURIComponent(arg)}`);
    console.log(`deleted webhook ${arg}`);
    break;
  }
  case 'rotate': {
    if (!arg) {
      console.error('usage: ... rotate <webhook_id>');
      process.exit(1);
    }
    const out = await call('POST', `/api/webhooks/${encodeURIComponent(arg)}/rotate-signing-secret`, {});
    console.log(JSON.stringify(out, null, 2));
    if (out && out.signing_secret) {
      console.error('');
      console.error(`new signing_secret: ${out.signing_secret}`);
    }
    break;
  }
  default:
    console.error('usage: node scripts/revolut-webhook.mjs <list|create|delete|rotate> [arg]');
    process.exit(1);
}
