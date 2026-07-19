'use client';

import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { clientEnv } from '@/env';

export default function FrontendObservability() {
  if (typeof window === 'undefined' || faro.api) {
    return null;
  }

  try {
    initializeFaro({
      url: clientEnv.NEXT_PUBLIC_FARO_URL!,
      app: {
        name: clientEnv.NEXT_PUBLIC_FARO_APP_NAME || 'storefront',
        version: '0.1.0',
        environment: process.env.NODE_ENV,
      },
      instrumentations: [...getWebInstrumentations(), new TracingInstrumentation()],
      ignoreErrors: [
        /^ResizeObserver loop limit exceeded$/,
        /^ResizeObserver loop completed with undelivered notifications$/,
        /^Script error\.$/,
        /chrome-extension:\/\//,
        /moz-extension:\/\//,
      ],
      ignoreUrls: [
        /googletagmanager\.com/,
        /analytics\.google\.com/,
        /www\.google-analytics\.com/,
        /connect\.facebook\.net/,
        /facebook\.com\/tr/,
      ],
    });
  } catch {
    // Silently fail — Faro should never break the app
  }

  return null;
}
