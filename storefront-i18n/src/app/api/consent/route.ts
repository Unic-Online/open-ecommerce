import { NextResponse } from 'next/server'
import { z } from 'zod'
import { saveConsent } from '@/lib/contacts'
import { extractClientIp } from '@/lib/meta-capi'

const consentRequestSchema = z.object({
  version: z.string().trim().min(1).max(16),
  analytics: z.boolean(),
  marketing: z.boolean(),
  source: z.enum([
    'banner_accept_all',
    'banner_decline_all',
    'banner_customize',
    'footer_link',
  ]),
  givenAt: z.string().datetime().optional(),
  email: z.string().trim().email().max(320).optional(),
}).strict()

export async function POST(request: Request) {
  let parsed
  try {
    parsed = consentRequestSchema.safeParse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid consent payload', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const clientIp = extractClientIp(request.headers)
  const clientUserAgent = request.headers.get('user-agent')?.slice(0, 2048) ?? undefined

  // Audit-trail write is best-effort: if Mongo is unavailable, we still
  // honor the localStorage choice client-side. Log loudly so ops notices.
  try {
    await saveConsent({
      version: data.version,
      analytics: data.analytics,
      marketing: data.marketing,
      source: data.source,
      givenAt: data.givenAt ? new Date(data.givenAt) : new Date(),
      email: data.email,
      clientIp,
      clientUserAgent,
    })
  } catch (err) {
    console.error('[consent] failed to persist audit record:', err)
    return NextResponse.json({ ok: false, persisted: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true, persisted: true })
}
