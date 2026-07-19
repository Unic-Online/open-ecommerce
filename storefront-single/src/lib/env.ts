/**
 * Compatibility shim — the env layer now lives in `src/env.ts`.
 *
 * `instrumentation.ts` and the boot-preflight tests import the prod-preflight
 * surface from here; re-export it so those call sites stay stable. New code
 * should import directly from `@/env`.
 */
export {
  REQUIRED_PROD_ENV,
  validateProdEnv,
  isProductionRuntime,
  assertProdEnvOrThrow,
  type ValidateResult,
} from '@/env';
