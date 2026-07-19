import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, type Db } from 'mongodb';

// E2E test DB fixture. Connects to the same Atlas cluster the dev server
// uses, but writes to the isolated `storefront-e2e` database (configured
// via webServer.env in playwright.config.ts so the dev server reads from
// the same place).

let client: MongoClient | null = null;

function readMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const m = content.match(/^MONGODB_URI=(.+)$/m);
    if (m) return m[1];
  }
  throw new Error(
    'MONGODB_URI not found in process.env or .env.local — required for e2e DB fixtures',
  );
}

export async function getTestDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(readMongoUri());
    await client.connect();
  }
  return client.db('storefront-e2e');
}

export async function closeTestDb(): Promise<void> {
  if (client) await client.close();
  client = null;
}

interface CartItem {
  id: string;
  productType: string;
  productName: string;
  quantity: number;
  image: string;
  unitPrice: number;
  slug: string;
  shortName: string;
}

export interface SeedCartArgs {
  cartId: string;
  email: string;
  items: CartItem[];
  couponCode?: string;
  status?: 'active' | 'abandoned' | 'recovered' | 'completed';
  recoveryStep?: 0 | 1 | 2 | 3;
}

export async function seedCart(args: SeedCartArgs): Promise<void> {
  const db = await getTestDb();
  const now = new Date();
  await db.collection('carts').insertOne({
    cartId: args.cartId,
    email: args.email.toLowerCase(),
    items: args.items,
    subtotal: args.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    // Single market (`main`); the template is English-only.
    market: 'main',
    marketingConsent: false,
    status: args.status ?? 'abandoned',
    recoveryStep: args.recoveryStep ?? 0,
    recoveryEmails: [],
    couponCode: args.couponCode,
    createdAt: now,
    lastActivityAt: now,
    abandonedAt: now,
  });
}

export interface SeedCouponArgs {
  code: string;
  cartId: string;
  email: string;
  discountPercent?: number;
  validUntil?: Date;
  usedCount?: 0 | 1;
}

export async function seedCoupon(args: SeedCouponArgs): Promise<void> {
  const db = await getTestDb();
  const now = new Date();
  await db.collection('cart_coupons').insertOne({
    code: args.code,
    cartId: args.cartId,
    email: args.email.toLowerCase(),
    discountPercent: args.discountPercent ?? 10,
    maxUses: 1,
    usedCount: args.usedCount ?? 0,
    validFrom: now,
    validUntil:
      args.validUntil ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: now,
  });
}

export async function deleteCartAndCoupons(cartId: string): Promise<void> {
  const db = await getTestDb();
  await db.collection('carts').deleteMany({ cartId });
  await db.collection('cart_coupons').deleteMany({ cartId });
}

interface OrderItem {
  id: string;
  productId: string;
  productType: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  currency: 'EUR';
  slug: string;
  shortName: string;
  image: string;
}

export interface SeedOrderFulfillment {
  status?: 'unfulfilled' | 'shipped' | 'delivered';
  carrier?: string;
  trackingNumber?: string;
  deliveredAt?: Date;
  reviewEmailSentAt?: Date;
}

export interface SeedOrderArgs {
  orderId: string;
  email: string;
  status?:
    | 'received'
    | 'pending_payment'
    | 'paid'
    | 'cancelled'
    | 'failed'
    | 'refunded';
  paymentMethod?: 'cod' | 'card';
  totalPrice?: number;
  items?: OrderItem[];
  shipping?: Record<string, unknown>;
  fulfillment?: SeedOrderFulfillment;
}

export async function seedOrder(args: SeedOrderArgs): Promise<void> {
  const db = await getTestDb();
  const now = new Date();
  // Single market (`main`), single currency (EUR).
  const market = 'main';
  const currency = 'EUR';
  const total = args.totalPrice ?? 459;
  const items: OrderItem[] = args.items ?? [
    {
      id: 'furniture__oslo-nightstand',
      productId: 'furniture__oslo-nightstand',
      productType: 'furniture',
      productName: 'Oslo Nightstand',
      quantity: 1,
      unitPrice: total,
      currency,
      slug: 'oslo-nightstand',
      shortName: 'Oslo Nightstand',
      image: '',
    },
  ];

  await db.collection('orders').insertOne({
    orderId: args.orderId,
    email: args.email.toLowerCase(),
    shipping: args.shipping ?? {
      firstName: 'Alex',
      lastName: 'E2E',
      email: args.email.toLowerCase(),
      phone: '0712345678',
      county: 'Greater London',
      city: 'London',
      address: '10 Example Street',
      country: 'GB',
      postalCode: 'SW1A 1AA',
      billingType: 'individual',
      useAltShipping: false,
    },
    items,
    subtotal: total,
    discount: 0,
    shippingCost: 0,
    totalPrice: total,
    paymentMethod: args.paymentMethod ?? 'cod',
    status: args.status ?? 'received',
    market,
    currency,
    marketingConsent: false,
    ...(args.fulfillment ? { fulfillment: args.fulfillment } : {}),
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteOrder(orderId: string): Promise<void> {
  const db = await getTestDb();
  await db.collection('orders').deleteMany({ orderId });
}

export async function deleteReviewsByName(slug: string, name: string): Promise<void> {
  const db = await getTestDb();
  await db.collection('reviews').deleteMany({ slug, name });
}
