// Next.js instrumentation hook — runs once per cold start, before any request handler.
// Boot-time env validation: production deploys with missing secrets fail fast in Vercel
// logs instead of 500ing on the first customer checkout.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertProdEnvOrThrow } = await import('./src/env');
  assertProdEnvOrThrow();
}
