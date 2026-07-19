import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyRevolutWebhookSignature } from '@/lib/revolut';

const SECRET = 'whsec_test_secret_abcdef0123456789';

function sign(rawBody: string, ts: number, secret = SECRET): string {
  const payload = `v1.${ts}.${rawBody}`;
  const hex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `v1=${hex}`;
}

describe('verifyRevolutWebhookSignature', () => {
  const now = 1_700_000_000_000;
  const body = '{"event":"ORDER_COMPLETED","order_id":"abc-123","merchant_order_ext_ref":"ABCD1234"}';

  it('accepts a valid signature within the replay window', () => {
    const ts = now - 30_000;
    const sig = sign(body, ts);
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: sig,
      timestampHeader: String(ts),
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects when the timestamp is older than 5 minutes', () => {
    const ts = now - 6 * 60_000;
    const sig = sign(body, ts);
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: sig,
      timestampHeader: String(ts),
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/tolerance/);
  });

  it('rejects a body that has been tampered with', () => {
    const ts = now - 1_000;
    const sig = sign(body, ts);
    const tampered = body.replace('"abc-123"', '"hijack-456"');
    const result = verifyRevolutWebhookSignature({
      rawBody: tampered,
      signatureHeader: sig,
      timestampHeader: String(ts),
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/mismatch/);
  });

  it('accepts when one of multiple signatures matches (rotation window)', () => {
    const ts = now - 1_000;
    const valid = sign(body, ts);
    const bogus = 'v1=' + 'f'.repeat(64);
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: `${bogus}, ${valid}`,
      timestampHeader: String(ts),
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects when the signing secret is empty', () => {
    const ts = now - 1_000;
    const sig = sign(body, ts);
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: sig,
      timestampHeader: String(ts),
      signingSecret: '',
      now,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: null,
      timestampHeader: String(now),
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when the timestamp header is missing', () => {
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: sign(body, now),
      timestampHeader: null,
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when the timestamp header is not a number', () => {
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: sign(body, now),
      timestampHeader: 'not-a-number',
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when signed with the wrong secret', () => {
    const ts = now - 1_000;
    const sig = sign(body, ts, 'whsec_wrong_secret');
    const result = verifyRevolutWebhookSignature({
      rawBody: body,
      signatureHeader: sig,
      timestampHeader: String(ts),
      signingSecret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/mismatch/);
  });
});
