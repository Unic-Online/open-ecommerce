import { NextResponse } from 'next/server'
import { upsertContact } from '@/lib/contacts'
import { captureEmailSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    // sendBeacon bodies can arrive empty/truncated on page unload — that is
    // routine traffic, not an internal error. A null body fails schema
    // validation below and gets the same 400 as any other invalid payload.
    const body = await request.json().catch(() => null)
    const result = captureEmailSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: 'Email invalid' }, { status: 400 })
    }

    const { email, source, firstName, lastName } = result.data

    await upsertContact(email, {
      source: source || 'email_popup',
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email capture error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
