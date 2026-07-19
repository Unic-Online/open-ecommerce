/**
 * Identifies non-production environments so outbound artefacts (today: emails)
 * can be visibly tagged. Server-only — never import from client bundles.
 *
 * Detection (first match wins):
 *   1. `MONGODB_DB_NAME === 'staging'` — our staging convention; the staging
 *      branch on Vercel sets this explicitly so prod can never trip it.
 *   2. `VERCEL_GIT_COMMIT_REF === 'staging'` — preview build of the staging
 *      branch even if the DB env was missed.
 *   3. `VERCEL_ENV === 'preview'` — any other preview build (PR, feature
 *      branch). Tagged as `PREVIEW` rather than `STAGING`.
 * Prod returns `null`.
 *
 * Caller contract:
 *   - Treat `null` as "no marker; ship as-is".
 *   - The HTML banner is a self-contained `<div>`; insert it after `<body...>`.
 *   - The subject prefix already contains a trailing space.
 */

import { serverEnv } from '@/env';

export interface StageMarker {
  label: 'STAGING' | 'PREVIEW';
  subjectPrefix: string;
  htmlBanner: string;
}

export function getStageMarker(): StageMarker | null {
  const dbName = serverEnv.MONGODB_DB_NAME?.toLowerCase();
  if (dbName === 'staging') return makeMarker('STAGING');
  if (process.env.VERCEL_GIT_COMMIT_REF === 'staging') return makeMarker('STAGING');
  if (process.env.VERCEL_ENV === 'preview') return makeMarker('PREVIEW');
  return null;
}

function makeMarker(label: 'STAGING' | 'PREVIEW'): StageMarker {
  const banner = `<div style="background:#fde047;color:#1a1a1a;padding:10px 16px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-bottom:2px solid #ca8a04;">${label} ENVIRONMENT — THIS EMAIL IS NOT FROM PRODUCTION</div>`;
  return {
    label,
    subjectPrefix: `[${label}] `,
    htmlBanner: banner,
  };
}
