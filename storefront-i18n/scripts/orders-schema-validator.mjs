#!/usr/bin/env node
/**
 * Apply (or remove) a `$jsonSchema` validator on the `orders` collection.
 *
 *   pnpm orders:validator                 # dry-run: print diff vs current validator
 *   pnpm orders:validator --apply         # write the validator
 *   pnpm orders:validator --apply --strict  # also require legacy docs to validate
 *   pnpm orders:validator --remove        # drop the validator
 *
 * Default validation policy:
 *   - validationLevel: 'moderate'  → only inserts and updates of already-
 *     valid docs are checked. Legacy docs that pre-date a required field
 *     can still be read and updated until they get cleaned. Use --strict
 *     after the backfill to flip to 'strict'.
 *   - validationAction: 'error'    → invalid writes are rejected, not just
 *     logged. Production posture.
 *
 * Required fields are derived from `src/lib/orders/types.ts` OrderDoc.
 * Update both files together if the type changes.
 *
 * Reads MONGODB_URI (and optional MONGODB_DB_NAME, default `storefront`)
 * from the process env or `.env.local`.
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

const ORDER_STATUSES = [
  'received',
  'pending_payment',
  'paid',
  'cancelled',
  'failed',
  'refunded',
];

const VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'orderId',
      'email',
      'shipping',
      'items',
      'subtotal',
      'discount',
      'shippingCost',
      'totalPrice',
      'paymentMethod',
      'status',
      'market',
      'locale',
      'currency',
      'marketingConsent',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      orderId: {
        bsonType: 'string',
        pattern: '^[0-9A-F]{8}$',
        description: '8-character uppercase hex order id',
      },
      email: {
        bsonType: 'string',
        pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
      },
      shipping: { bsonType: 'object' },
      items: { bsonType: 'array', minItems: 1 },
      subtotal: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      discount: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      shippingCost: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      totalPrice: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      paymentMethod: { enum: ['ramburs', 'card'] },
      status: { enum: ORDER_STATUSES },
      market: { enum: ['ro', 'french'] },
      locale: { enum: ['ro', 'fr'] },
      currency: { enum: ['RON', 'EUR'] },
      marketingConsent: { bsonType: 'bool' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
    additionalProperties: true,
  },
};

async function describeCurrent(db) {
  const info = await db
    .listCollections({ name: 'orders' }, { nameOnly: false })
    .toArray();
  if (info.length === 0) return null;
  const opts = info[0].options ?? {};
  return {
    validator: opts.validator ?? null,
    validationLevel: opts.validationLevel ?? 'strict',
    validationAction: opts.validationAction ?? 'error',
  };
}

async function main() {
  loadEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing — set it in env or .env.local');
    process.exit(2);
  }
  const dbName = process.env.MONGODB_DB_NAME || 'storefront';
  const apply = process.argv.includes('--apply');
  const strict = process.argv.includes('--strict');
  const remove = process.argv.includes('--remove');

  if (apply && remove) {
    console.error('--apply and --remove are mutually exclusive');
    process.exit(2);
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const current = await describeCurrent(db);

    console.log(`[${dbName}].orders current validator state:`);
    if (!current) {
      console.log('  collection does not exist yet');
    } else if (!current.validator) {
      console.log('  no validator');
    } else {
      console.log(`  level=${current.validationLevel} action=${current.validationAction}`);
      console.log('  validator:', JSON.stringify(current.validator, null, 2));
    }

    if (remove) {
      if (!apply && !process.argv.includes('--apply')) {
        console.log('\nDry-run. Re-run with --apply to remove the validator.');
        return;
      }
      await db.command({
        collMod: 'orders',
        validator: {},
        validationLevel: 'off',
        validationAction: 'warn',
      });
      console.log('\nValidator removed.');
      return;
    }

    const targetLevel = strict ? 'strict' : 'moderate';

    console.log(`\nProposed validator (level=${targetLevel}, action=error):`);
    console.log(JSON.stringify(VALIDATOR, null, 2));

    // Show how many existing docs would fail the validator under strict mode.
    if (current) {
      const wouldFail = await db.collection('orders').countDocuments({
        $or: [
          { orderId: { $exists: false } },
          { email: { $exists: false } },
          { paymentMethod: { $nin: ['ramburs', 'card'] } },
          { status: { $nin: ORDER_STATUSES } },
          { market: { $nin: ['ro', 'french'] } },
          { locale: { $nin: ['ro', 'fr'] } },
          { currency: { $nin: ['RON', 'EUR'] } },
          { marketingConsent: { $exists: false } },
          { createdAt: { $exists: false } },
        ],
      });
      console.log(`\nLegacy docs that would fail the validator: ${wouldFail}`);
      if (wouldFail > 0 && strict) {
        console.warn(
          'WARN: --strict will block updates on those legacy docs. Backfill first.',
        );
      }
    }

    if (!apply) {
      console.log('\nDry-run. Re-run with --apply to install the validator.');
      return;
    }

    await db.command({
      collMod: 'orders',
      validator: VALIDATOR,
      validationLevel: targetLevel,
      validationAction: 'error',
    });
    console.log(`\nValidator installed. level=${targetLevel} action=error`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
