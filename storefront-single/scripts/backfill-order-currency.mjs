#!/usr/bin/env node
/**
 * Backfill `currency` on legacy `orders` docs that pre-date the field.
 *
 *   pnpm backfill:currency                # dry-run (default)
 *   pnpm backfill:currency --apply        # write the update
 *
 * Derivation:
 *   - market === 'ro'       → currency = 'RON'
 *   - market === 'english'  → currency = 'EUR'
 *
 * Reads MONGODB_URI (and optional MONGODB_DB_NAME, default `storefront`)
 * from `.env.local` (sibling of `package.json`) or the process env.
 *
 * Why a defensive guard alone is not enough: `formatMoney` was hardened to
 * fall back when `currency` is missing, but the underlying data is still
 * wrong — admin reports won't show the right symbol for those rows. This
 * one-shot script makes the data correct so the guard becomes belt-and-
 * suspenders rather than load-bearing.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = join(APP_ROOT, '.env.local');

function loadEnv() {
  if (!existsSync(ENV_LOCAL)) return;
  const text = readFileSync(ENV_LOCAL, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const MARKET_TO_CURRENCY = {
  ro: 'RON',
  english: 'EUR',
};

async function main() {
  loadEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing — set it in env or .env.local');
    process.exit(2);
  }
  const dbName = process.env.MONGODB_DB_NAME || 'storefront';
  const apply = process.argv.includes('--apply');

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const orders = db.collection('orders');

    const filter = {
      $or: [
        { currency: { $exists: false } },
        { currency: null },
        { currency: '' },
      ],
    };

    const total = await orders.countDocuments(filter);
    console.log(`[${dbName}] orders missing currency: ${total}`);
    if (total === 0) {
      console.log('Nothing to backfill.');
      return;
    }

    const breakdown = await orders
      .aggregate([
        { $match: filter },
        { $group: { _id: '$market', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    for (const row of breakdown) {
      const target = MARKET_TO_CURRENCY[row._id];
      const verdict = target ? `→ ${target}` : '⚠ unknown market — will skip';
      console.log(`  market=${JSON.stringify(row._id)}  count=${row.count}  ${verdict}`);
    }

    if (!apply) {
      console.log('\nDry-run. Re-run with --apply to write the update.');
      return;
    }

    let updated = 0;
    for (const [market, currency] of Object.entries(MARKET_TO_CURRENCY)) {
      const res = await orders.updateMany(
        { ...filter, market },
        { $set: { currency, updatedAt: new Date() } },
      );
      console.log(`  market=${market}  updated=${res.modifiedCount}`);
      updated += res.modifiedCount;
    }
    const skipped = total - updated;
    console.log(`\nApplied. updated=${updated} skipped=${skipped}`);
    if (skipped > 0) {
      console.log('Skipped rows have an unknown `market` — investigate manually:');
      const sample = await orders
        .find(filter, { projection: { orderId: 1, market: 1, _id: 0 } })
        .limit(10)
        .toArray();
      for (const row of sample) console.log('  ', row);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
