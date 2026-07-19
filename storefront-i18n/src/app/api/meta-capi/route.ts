import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { clientEnv, serverEnv } from '@/env'
import {
  ALLOWED_META_EVENTS,
  extractClientIp,
  sendCapiEvent,
  type MetaEventName,
} from '@/lib/meta-capi'

const optionalString = (max: number) =>
  z.string().trim().min(1).max(max).optional()

const metaCapiRequestSchema = z.object({
  eventName: z.enum(ALLOWED_META_EVENTS),
  eventId: z.string().trim().min(1).max(128),
  eventSourceUrl: z.string().trim().url().max(2048),
  fbp: optionalString(512),
  fbc: optionalString(512),
  externalId: optionalString(512),
  userAgent: optionalString(2048),
  customData: z.record(z.string(), z.unknown()).optional(),
  // Forwarded by the client when a Meta Test Events session is active.
  // Format: TEST<digits>. Only honored when present.
  testEventCode: z.string().trim().regex(/^TEST[A-Z0-9]{1,32}$/).optional(),
  userData: z.object({
    email: z.string().trim().email().max(320).optional(),
    phone: optionalString(64),
    firstName: optionalString(100),
    lastName: optionalString(100),
    city: optionalString(100),
    country: optionalString(100),
    postalCode: optionalString(32),
    externalId: optionalString(512),
  }).strict().optional(),
}).strict()

export async function POST(request: NextRequest) {
  if (!clientEnv.NEXT_PUBLIC_META_PIXEL_ID || !serverEnv.META_CAPI_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'Meta Pixel ID or Access Token not configured' },
      { status: 500 }
    )
  }

  let parsed
  try {
    parsed = metaCapiRequestSchema.safeParse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Meta CAPI payload', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const clientIp = extractClientIp(request.headers)

  const result = await sendCapiEvent({
    eventName: data.eventName as MetaEventName,
    eventId: data.eventId,
    eventSourceUrl: data.eventSourceUrl,
    userData: {
      email: data.userData?.email,
      phone: data.userData?.phone,
      firstName: data.userData?.firstName,
      lastName: data.userData?.lastName,
      city: data.userData?.city,
      country: data.userData?.country,
      postalCode: data.userData?.postalCode,
      // Page-supplied externalId is the secondary override; otherwise use the
      // top-level browser external ID.
      externalId: data.userData?.externalId ?? data.externalId,
      fbp: data.fbp,
      fbc: data.fbc,
      clientIp,
      clientUserAgent: data.userAgent,
    },
    customData: data.customData,
    testEventCode: data.testEventCode,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.body }, { status: result.status || 500 })
  }
  return NextResponse.json({ success: true, result: result.body })
}
