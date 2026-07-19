import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/resend'
import { upsertContact } from '@/lib/contacts'
import { renderContactEmail } from '@/lib/emails/contact-email'
import { getMarketConfig } from '@/lib/market'
import { isValidRomanianPhone } from '@/lib/validation'

const contactSchema = z.object({
  firstName: z.string().min(1, 'Prenumele este obligatoriu').max(100),
  lastName: z.string().min(1, 'Numele este obligatoriu').max(100),
  email: z.string().email('Email invalid').max(200),
  phone: z.string().refine((v) => isValidRomanianPhone(v), 'Telefon invalid').max(40),
  subject: z.string().min(1, 'Subiectul este obligatoriu').max(200),
  message: z.string().min(1, 'Mesajul este obligatoriu').max(5000),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = contactSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Date invalide', issues: result.error.issues },
        { status: 400 }
      )
    }

    const { firstName, lastName, email, phone, subject, message } = result.data
    const marketConfig = getMarketConfig()
    const html = renderContactEmail({ firstName, lastName, email, phone, subject, message })

    await sendEmail({
      from: marketConfig.contact.fromEmail,
      to: [marketConfig.contact.businessEmail],
      subject: `Contact: ${subject} — ${firstName} ${lastName}`,
      html,
      replyTo: email,
    })

    upsertContact(email, {
      firstName,
      lastName,
      phone,
      source: 'contact_form',
    }).catch((err) => console.error('Failed to upsert contact:', err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact API error:', error)
    return NextResponse.json(
      { error: 'Eroare internă. Încearcă din nou.' },
      { status: 500 }
    )
  }
}
