import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, CSV_HEADER, escapeCsvCell, toCsvRow } from '@/lib/orders/csv';
import type { OrderDoc } from '@/lib/orders/types';

describe('escapeCsvCell — formula injection guard (CWE-1236)', () => {
  it('prefixes apostrophe to formula-leading cells', () => {
    // Each result is also wrapped in quotes only when the cell needs RFC 4180
    // quoting (contains ", \n, or \r — tab is intentionally NOT a quote trigger,
    // matching the standard).
    expect(escapeCsvCell('=cmd|"/c calc"!A0')).toBe('"\'=cmd|""/c calc""!A0"');
    expect(escapeCsvCell('+1+2')).toBe("'+1+2");
    expect(escapeCsvCell('-MERGE(A1)')).toBe("'-MERGE(A1)");
    expect(escapeCsvCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    expect(escapeCsvCell('\t=evil()')).toBe("'\t=evil()");
    expect(escapeCsvCell('\rfoo')).toBe('"\'\rfoo"');
  });

  it('does NOT prefix safe cells', () => {
    expect(escapeCsvCell('foo')).toBe('foo');
    expect(escapeCsvCell('alex@example.com')).toBe('alex@example.com');
    expect(escapeCsvCell(123)).toBe('123');
  });

  it('quotes and doubles internal quotes per RFC 4180', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('serializes Date as ISO 8601 UTC', () => {
    expect(escapeCsvCell(new Date('2026-05-06T10:11:12.000Z'))).toBe(
      '2026-05-06T10:11:12.000Z',
    );
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });
});

describe('toCsvRow + CSV_HEADER', () => {
  const order: OrderDoc = {
    orderId: 'ABCD1234',
    email: 'alex@example.com',
    shipping: {
      firstName: 'Alex',
      lastName: 'Doe',
      email: 'alex@example.com',
      phone: '0712345678',
      county: 'Bucuresti',
      city: 'Bucuresti',
      address: 'Str. Exemplu 1, sector 1',
      country: 'RO',
      postalCode: '010101',
      billingType: 'individual',
      useAltShipping: false,
    },
    items: [],
    subtotal: 1899,
    discount: 380,
    shippingCost: 0,
    totalPrice: 1519,
    paymentMethod: 'card',
    status: 'paid',
    market: 'main',
    currency: 'EUR',
    marketingConsent: true,
    fulfillment: { status: 'shipped', carrier: 'Sameday', trackingNumber: 'AWB123' },
    createdAt: new Date('2026-05-01T08:00:00Z'),
    updatedAt: new Date('2026-05-01T08:00:00Z'),
  };

  it('CSV_HEADER lists all columns in order', () => {
    expect(CSV_HEADER).toBe(CSV_COLUMNS.join(','));
    expect(CSV_COLUMNS).toContain('orderId');
    expect(CSV_COLUMNS).toContain('currency');
    expect(CSV_COLUMNS).toContain('totalPrice');
    expect(CSV_COLUMNS).toContain('fulfillmentStatus');
  });

  it('serializes a clean fixture predictably', () => {
    expect(toCsvRow(order)).toBe(
      [
        'ABCD1234',
        '2026-05-01T08:00:00.000Z',
        'paid',
        'card',
        'main',
        'EUR',
        '1899',
        '380',
        '0',
        '1519',
        'alex@example.com',
        'Alex',
        'Doe',
        '0712345678',
        'RO',
        'Bucuresti',
        'Bucuresti',
        '"Str. Exemplu 1, sector 1"',
        '010101',
        'shipped',
        'Sameday',
        'AWB123',
        '',
        '',
        '',
        '',
        '',
      ].join(','),
    );
  });

  it('quotes first/last name when it contains a comma (formula safety + RFC 4180)', () => {
    const tricky: OrderDoc = {
      ...order,
      shipping: { ...order.shipping, firstName: '=2+5', lastName: 'O\'Reilly' },
    };
    const row = toCsvRow(tricky);
    // The =2+5 cell must start with apostrophe to defuse formula evaluation.
    // No RFC-4180 quote wrap is added because the guarded cell contains no
    // ", \n, or \r — the apostrophe alone is sufficient.
    expect(row).toContain(",'=2+5,");
    expect(row).toContain("O'Reilly");
  });
});
