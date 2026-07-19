import { faro } from '@grafana/faro-web-sdk';

export function logProductEvent(name: string, attributes: Record<string, string>) {
  if (typeof window === 'undefined') return;
  if (!faro?.api) return;
  try {
    faro.api.pushEvent(name, attributes);
  } catch {
    // Faro should never break the app
  }
}

export function logProductError(error: unknown, context?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  if (!faro?.api) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    faro.api.pushError(err, { context });
  } catch {
    // ignore
  }
}
