import { getDb } from '@/lib/mongodb';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { CARTS_COLLECTION } from '@/plugins/abandoned-cart/shared/types';
import { formatPrice } from '@/lib/format';
import styles from '../../Admin.module.css';

export const dynamic = 'force-dynamic';

interface ProductRow {
  slug: string;
  productName: string;
  abandonedCount: number;
  abandonedQty: number;
  abandonedValue: number;
}

async function loadTopAbandoned(): Promise<ProductRow[]> {
  if (isAbandonedCartDryRun()) return [];
  const db = await getDb();
  const carts = db.collection(CARTS_COLLECTION);

  const pipeline = [
    { $match: { status: { $in: ['abandoned', 'recovered'] } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.slug',
        productName: { $first: '$items.productName' },
        abandonedCount: { $sum: 1 },
        abandonedQty: { $sum: '$items.quantity' },
        abandonedValue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
      },
    },
    { $sort: { abandonedCount: -1 } },
    { $limit: 25 },
  ];

  const docs = await carts.aggregate(pipeline).toArray();
  return docs.map((d) => ({
    slug: String(d._id ?? ''),
    productName: typeof d.productName === 'string' ? d.productName : '—',
    abandonedCount: Number(d.abandonedCount ?? 0),
    abandonedQty: Number(d.abandonedQty ?? 0),
    abandonedValue: Number(d.abandonedValue ?? 0),
  }));
}

export default async function AdminProductsPage() {
  const rows = await loadTopAbandoned();

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Top abandoned products</h1>
      <p className={styles.pageIntro}>
        Aggregated from carts in <code>abandoned</code> or <code>recovered</code> status.
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Carts</th>
              <th>Total qty</th>
              <th>Lost value (subtotal)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  No abandoned product data yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.slug}>
                  <td data-label="Product">
                    <strong>{row.productName}</strong>
                    <span className={styles.cellSub}>{row.slug}</span>
                  </td>
                  <td data-label="Carts">{row.abandonedCount}</td>
                  <td data-label="Total qty">{row.abandonedQty}</td>
                  <td data-label="Lost value">{formatPrice(row.abandonedValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
