import { describe, expect, it } from 'vitest';
import {
  ALLOWED_FROM,
  ALLOWED_TRANSITIONS,
  ORDER_STATUSES,
  TERMINAL_STATUSES,
  isAllowed,
  isTerminal,
  type OrderStatus,
} from '@/lib/orders/status-machine';

describe('orders status machine', () => {
  it('matches the documented transition table', () => {
    expect(ALLOWED_TRANSITIONS).toMatchInlineSnapshot(`
      {
        "cancelled": [],
        "failed": [
          "cancelled",
        ],
        "paid": [
          "refunded",
          "cancelled",
        ],
        "pending_payment": [
          "paid",
          "cancelled",
          "failed",
        ],
        "received": [
          "paid",
          "cancelled",
          "refunded",
        ],
        "refunded": [],
      }
    `);
  });

  describe('isAllowed', () => {
    // Exhaustive (from, to) matrix. For every from→to pair, isAllowed must
    // agree with ALLOWED_TRANSITIONS. The `as` cast is safe — we iterate the
    // closed `ORDER_STATUSES` array.
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected = ALLOWED_TRANSITIONS[from].includes(to);
        it(`${from} → ${to} = ${expected}`, () => {
          expect(isAllowed(from as OrderStatus, to as OrderStatus)).toBe(expected);
        });
      }
    }

    it('refuses self-transitions', () => {
      for (const s of ORDER_STATUSES) {
        expect(isAllowed(s, s)).toBe(false);
      }
    });

    it('refuses any transition out of a terminal status', () => {
      for (const t of TERMINAL_STATUSES) {
        for (const to of ORDER_STATUSES) {
          expect(isAllowed(t, to)).toBe(false);
        }
      }
    });
  });

  describe('isTerminal', () => {
    it('returns true exactly for cancelled and refunded', () => {
      for (const s of ORDER_STATUSES) {
        expect(isTerminal(s)).toBe(s === 'cancelled' || s === 'refunded');
      }
    });
  });

  describe('ALLOWED_FROM', () => {
    it('is the inverse of ALLOWED_TRANSITIONS', () => {
      for (const to of ORDER_STATUSES) {
        for (const from of ORDER_STATUSES) {
          const direct = ALLOWED_TRANSITIONS[from].includes(to);
          const inverse = ALLOWED_FROM[to].includes(from);
          expect(inverse).toBe(direct);
        }
      }
    });

    it('terminal targets have a non-empty ALLOWED_FROM (refunded reachable from received/paid)', () => {
      expect(ALLOWED_FROM.refunded).toEqual(expect.arrayContaining(['received', 'paid']));
      expect(ALLOWED_FROM.cancelled).toEqual(
        expect.arrayContaining(['received', 'pending_payment', 'paid', 'failed']),
      );
    });
  });
});
