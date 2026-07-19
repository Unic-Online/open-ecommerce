import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertProdEnvOrThrow, isProductionRuntime, REQUIRED_PROD_ENV, validateProdEnv } from '@/lib/env';

describe('Boot env preflight (B5)', () => {
  const snapshot = { ...process.env };

  beforeEach(() => {
    for (const k of REQUIRED_PROD_ENV) process.env[k] = 'present';
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in snapshot)) delete process.env[k];
    }
    Object.assign(process.env, snapshot);
  });

  it('returns ok when all required vars are set', () => {
    expect(validateProdEnv()).toEqual({ ok: true, missing: [] });
  });

  it('lists every missing var when several are unset', () => {
    delete process.env.MONGODB_URI;
    delete process.env.RESEND_API_KEY;
    const result = validateProdEnv();
    expect(result.ok).toBe(false);
    expect(new Set(result.missing)).toEqual(new Set(['MONGODB_URI', 'RESEND_API_KEY']));
  });

  it('treats blank strings as missing', () => {
    process.env.ADMIN_PASSWORD = '   ';
    const result = validateProdEnv();
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('ADMIN_PASSWORD');
  });

  it('isProductionRuntime is true only when VERCEL_ENV === production', () => {
    delete process.env.VERCEL_ENV;
    expect(isProductionRuntime()).toBe(false);
    process.env.VERCEL_ENV = 'preview';
    expect(isProductionRuntime()).toBe(false);
    process.env.VERCEL_ENV = 'production';
    expect(isProductionRuntime()).toBe(true);
  });

  it('assertProdEnvOrThrow no-ops outside production', () => {
    delete process.env.VERCEL_ENV;
    delete process.env.MONGODB_URI;
    expect(() => assertProdEnvOrThrow()).not.toThrow();
  });

  it('assertProdEnvOrThrow throws in production when a var is missing', () => {
    process.env.VERCEL_ENV = 'production';
    delete process.env.MONGODB_URI;
    expect(() => assertProdEnvOrThrow()).toThrow(/MONGODB_URI/);
  });
});
