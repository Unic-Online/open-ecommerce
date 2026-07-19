import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

const PIXEL_ID = '1000000000000001'
const ACCESS_TOKEN = 'test-token'

const { mockCaptureError } = vi.hoisted(() => ({ mockCaptureError: vi.fn() }))

vi.mock('@/lib/error-sink', () => ({
  captureError: mockCaptureError,
}))

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function importFreshModule() {
  vi.resetModules()
  return import('@/lib/meta-capi')
}

describe('normalizePhoneE164', () => {
  it('converts RO national number with leading 0 to E.164 digits', async () => {
    const { normalizePhoneE164 } = await importFreshModule()
    expect(normalizePhoneE164('0712 345 678')).toBe('40712345678')
    expect(normalizePhoneE164('0712345678')).toBe('40712345678')
  })

  it('preserves already-E.164 phones in either +40 or 40 form', async () => {
    const { normalizePhoneE164 } = await importFreshModule()
    expect(normalizePhoneE164('+40 712 345 678')).toBe('40712345678')
    expect(normalizePhoneE164('40712345678')).toBe('40712345678')
  })

  it('returns empty string for inputs with no digits', async () => {
    const { normalizePhoneE164 } = await importFreshModule()
    expect(normalizePhoneE164('')).toBe('')
    expect(normalizePhoneE164('   ')).toBe('')
  })

  it('passes through non-RO international numbers unchanged (digits-only)', async () => {
    // Best-effort: caller is responsible for the country code, we just
    // strip non-digits when we can't infer the trunk-prefix.
    const { normalizePhoneE164 } = await importFreshModule()
    expect(normalizePhoneE164('+1 415 555 1234')).toBe('14155551234')
  })

  it('converts a FR national number to the 33 prefix when the country hints France', async () => {
    const { normalizePhoneE164 } = await importFreshModule()
    // The exact bug shape: a French mobile must NOT become 40612345678.
    expect(normalizePhoneE164('06 12 34 56 78', 'FR')).toBe('33612345678')
    expect(normalizePhoneE164('06 12 34 56 78', 'France')).toBe('33612345678')
    expect(normalizePhoneE164('0612345678', 'fr')).toBe('33612345678')
    expect(normalizePhoneE164('06-12-34-56-78', 'française')).toBe('33612345678')
  })

  it('preserves already-prefixed +33/33 inputs regardless of the hint', async () => {
    const { normalizePhoneE164 } = await importFreshModule()
    expect(normalizePhoneE164('+33 6 12 34 56 78', 'FR')).toBe('33612345678')
    expect(normalizePhoneE164('33612345678', 'France')).toBe('33612345678')
    // A FR-prefixed phone on an RO-hinted order must stay French.
    expect(normalizePhoneE164('+33 6 12 34 56 78', 'România')).toBe('33612345678')
  })

  it('keeps RO trunk rewriting for RO hints and as the default (no hint)', async () => {
    const { normalizePhoneE164 } = await importFreshModule()
    expect(normalizePhoneE164('0712 345 678', 'România')).toBe('40712345678')
    expect(normalizePhoneE164('0712 345 678', 'RO')).toBe('40712345678')
    expect(normalizePhoneE164('0712 345 678', 'Romania')).toBe('40712345678')
    // No hint → existing RO semantics preserved.
    expect(normalizePhoneE164('0612345678')).toBe('40612345678')
    // RO-prefixed input under a FR hint stays Romanian.
    expect(normalizePhoneE164('+40 712 345 678', 'France')).toBe('40712345678')
  })
})

describe('extractClientIp', () => {
  it('uses first entry of x-forwarded-for', async () => {
    const { extractClientIp } = await importFreshModule()
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.42, 198.51.100.7' })
    expect(extractClientIp(headers)).toBe('203.0.113.42')
  })

  it('falls back to x-real-ip when forwarded-for is absent', async () => {
    const { extractClientIp } = await importFreshModule()
    const headers = new Headers({ 'x-real-ip': '203.0.113.99' })
    expect(extractClientIp(headers)).toBe('203.0.113.99')
  })

  it('returns undefined when no IP headers are present (no synthetic fallback)', async () => {
    const { extractClientIp } = await importFreshModule()
    const headers = new Headers()
    expect(extractClientIp(headers)).toBeUndefined()
  })
})

describe('isServerPurchaseDisabled', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('is false by default', async () => {
    vi.stubEnv('META_CAPI_DISABLE_SERVER_PURCHASE', '')
    const { isServerPurchaseDisabled } = await importFreshModule()
    expect(isServerPurchaseDisabled()).toBe(false)
  })

  it('is true when env var is exactly "1"', async () => {
    vi.stubEnv('META_CAPI_DISABLE_SERVER_PURCHASE', '1')
    const { isServerPurchaseDisabled } = await importFreshModule()
    expect(isServerPurchaseDisabled()).toBe(true)
  })

  it('is false for any other truthy-looking value (strict-1 only)', async () => {
    vi.stubEnv('META_CAPI_DISABLE_SERVER_PURCHASE', 'true')
    const { isServerPurchaseDisabled } = await importFreshModule()
    expect(isServerPurchaseDisabled()).toBe(false)
  })
})

describe('sendCapiEvent', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', PIXEL_ID)
    vi.stubEnv('META_CAPI_ACCESS_TOKEN', ACCESS_TOKEN)
    vi.stubEnv('META_CAPI_TEST_EVENT_CODE', '')
    mockCaptureError.mockClear()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
    )
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns ok=false without fetching when pixel/token are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '')
    const { sendCapiEvent } = await importFreshModule()
    const result = await sendCapiEvent({
      eventName: 'PageView',
      eventId: 'test-1',
      eventSourceUrl: 'https://ro.shop.example.com/',
    })
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('hashes PII fields with SHA-256 lowercase hex', async () => {
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'Purchase',
      eventId: 'order-ABC',
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/ABC',
      userData: {
        email: 'BUYER@Example.com',
        phone: '0712 345 678',
        firstName: 'Doe',
        lastName: 'Jean-Francois',
        city: 'București',
        country: 'RO',
        postalCode: '012345',
      },
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const ud = body.data[0].user_data

    expect(ud.em).toEqual([sha256('buyer@example.com')])
    expect(ud.ph).toEqual([sha256('40712345678')])
    expect(ud.fn).toEqual([sha256('doe')])
    expect(ud.ln).toEqual([sha256('jean-francois')])
    expect(ud.ct).toEqual([sha256('bucurești')])
    expect(ud.country).toEqual([sha256('ro')])
    expect(ud.zp).toEqual([sha256('012345')])
  })

  it('hashes a FR phone with the 33 prefix when shipping country is France', async () => {
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'Purchase',
      eventId: 'order-FR1',
      eventSourceUrl: 'https://shop.example.com/confirmare/FR1',
      userData: {
        email: 'acheteur@example.fr',
        phone: '06 12 34 56 78',
        country: 'France',
      },
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const ud = body.data[0].user_data
    expect(ud.ph).toEqual([sha256('33612345678')])
  })

  it('omits client_ip_address when not supplied (no 127.0.0.1 fallback)', async () => {
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'PageView',
      eventId: 'test-2',
      eventSourceUrl: 'https://ro.shop.example.com/',
      userData: { clientUserAgent: 'Mozilla/5.0' },
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const ud = body.data[0].user_data
    expect(ud.client_ip_address).toBeUndefined()
    expect(ud.client_user_agent).toBe('Mozilla/5.0')
  })

  it('passes through eventId, eventSourceUrl, and action_source=website', async () => {
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'AddToCart',
      eventId: 'cart-evt-9',
      eventSourceUrl: 'https://ro.shop.example.com/mobilier/oslo-nightstand',
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const evt = body.data[0]
    expect(evt.event_id).toBe('cart-evt-9')
    expect(evt.event_source_url).toBe('https://ro.shop.example.com/mobilier/oslo-nightstand')
    expect(evt.event_name).toBe('AddToCart')
    expect(evt.action_source).toBe('website')
  })

  it('includes test_event_code in payload when META_CAPI_TEST_EVENT_CODE is set', async () => {
    vi.stubEnv('META_CAPI_TEST_EVENT_CODE', 'TEST52243')
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'PageView',
      eventId: 'test-3',
      eventSourceUrl: 'https://ro.shop.example.com/',
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.test_event_code).toBe('TEST52243')
  })

  it('does NOT include test_event_code when env var is empty', async () => {
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'PageView',
      eventId: 'test-4',
      eventSourceUrl: 'https://ro.shop.example.com/',
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.test_event_code).toBeUndefined()
  })

  it('returns ok=false on Graph API non-200 response', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad token' }), { status: 401 })
    )
    const { sendCapiEvent } = await importFreshModule()
    const result = await sendCapiEvent({
      eventName: 'PageView',
      eventId: 'test-5',
      eventSourceUrl: 'https://ro.shop.example.com/',
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
  })

  it('returns ok=false on network failure (no throw)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const { sendCapiEvent } = await importFreshModule()
    const result = await sendCapiEvent({
      eventName: 'PageView',
      eventId: 'test-6',
      eventSourceUrl: 'https://ro.shop.example.com/',
    })
    expect(result.ok).toBe(false)
  })

  it('reports Graph API errors to the error sink with event metadata and no raw PII', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'bad token' } }), { status: 401 })
    )
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'Purchase',
      eventId: 'ORDER-SINK1',
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/SINK1',
      userData: { email: 'buyer@example.com', phone: '0712345678' },
    })
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ eventName: 'Purchase', eventId: 'ORDER-SINK1', status: 401 }),
      expect.objectContaining({ tag: 'meta_capi_graph_error' }),
    )
    // PII must never reach the sink context — only event metadata.
    const context = JSON.stringify(mockCaptureError.mock.calls[0][1])
    expect(context).not.toContain('buyer@example.com')
    expect(context).not.toContain('0712345678')
  })

  it('reports fetch failures to the error sink', async () => {
    const netErr = new Error('ECONNREFUSED')
    fetchSpy.mockRejectedValueOnce(netErr)
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'AddToCart',
      eventId: 'evt-sink-2',
      eventSourceUrl: 'https://ro.shop.example.com/',
    })
    expect(mockCaptureError).toHaveBeenCalledWith(
      netErr,
      expect.objectContaining({ eventName: 'AddToCart', eventId: 'evt-sink-2' }),
      expect.objectContaining({ tag: 'meta_capi_fetch_failed' }),
    )
  })

  it('does not hit the error sink when the Graph API accepts the event', async () => {
    const { sendCapiEvent } = await importFreshModule()
    await sendCapiEvent({
      eventName: 'PageView',
      eventId: 'evt-ok',
      eventSourceUrl: 'https://ro.shop.example.com/',
    })
    expect(mockCaptureError).not.toHaveBeenCalled()
  })
})

describe('sendServerPurchase', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', PIXEL_ID)
    vi.stubEnv('META_CAPI_ACCESS_TOKEN', ACCESS_TOKEN)
    vi.stubEnv('META_CAPI_DISABLE_SERVER_PURCHASE', '')
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
    )
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('uses orderId as event_id and builds Purchase custom_data', async () => {
    const { sendServerPurchase } = await importFreshModule()
    await sendServerPurchase({
      orderId: 'A1B2C3D4',
      shipping: {
        email: 'buyer@example.com',
        phone: '0712345678',
        firstName: 'Doe',
        lastName: 'JF',
        city: 'București',
        country: 'RO',
        postalCode: '012345',
      },
      clientIp: '203.0.113.42',
      clientUserAgent: 'Mozilla/5.0 Acme',
      totalPrice: 480,
      currency: 'RON',
      contentIds: ['furniture__oslo-nightstand', 'furniture__aria-console'],
      numItems: 2,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/A1B2C3D4',
      marketingConsent: true,
    })

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const evt = body.data[0]
    expect(evt.event_name).toBe('Purchase')
    expect(evt.event_id).toBe('A1B2C3D4')
    expect(evt.custom_data).toMatchObject({
      value: 480,
      currency: 'RON',
      content_ids: ['furniture__oslo-nightstand', 'furniture__aria-console'],
      content_type: 'product',
      num_items: 2,
    })
    expect(evt.user_data.client_ip_address).toBe('203.0.113.42')
    expect(evt.user_data.em).toEqual([sha256('buyer@example.com')])
  })

  it('includes content_name, shipping and delivery_category in Purchase custom_data', async () => {
    const { sendServerPurchase } = await importFreshModule()
    await sendServerPurchase({
      orderId: 'RICH1234',
      shipping: { email: 'buyer@example.com' },
      totalPrice: 2510,
      currency: 'RON',
      contentIds: ['furniture__oslo-nightstand', 'furniture__aria-console'],
      numItems: 2,
      contentName: 'Oslo Nightstand, Aria Console',
      shippingCost: 29,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/RICH1234',
      marketingConsent: true,
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.data[0].custom_data).toMatchObject({
      content_name: 'Oslo Nightstand, Aria Console',
      shipping: 29,
      delivery_category: 'home_delivery',
    })
  })

  it('omits content_name/shipping when not provided but still tags delivery_category', async () => {
    const { sendServerPurchase } = await importFreshModule()
    await sendServerPurchase({
      orderId: 'BARE1234',
      shipping: { email: 'buyer@example.com' },
      totalPrice: 100,
      currency: 'RON',
      contentIds: ['furniture__oslo-nightstand'],
      numItems: 1,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/BARE1234',
      marketingConsent: true,
    })
    const customData = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string).data[0].custom_data
    expect(customData.content_name).toBeUndefined()
    expect(customData.shipping).toBeUndefined()
    expect(customData.delivery_category).toBe('home_delivery')
  })

  it('passes browser tracking IDs through un-hashed for Purchase match quality', async () => {
    const { sendServerPurchase } = await importFreshModule()
    await sendServerPurchase({
      orderId: 'TRACKED',
      shipping: { email: 'buyer@example.com' },
      totalPrice: 100,
      currency: 'RON',
      contentIds: ['furniture__oslo-nightstand'],
      numItems: 1,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/TRACKED',
      tracking: {
        fbp: 'fb.1.1596403881668.1116446470.ABcDEFGh',
        fbc: 'fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890.ABcDEFGh',
        externalId: 'sf_123',
      },
      marketingConsent: true,
    })

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    const ud = body.data[0].user_data
    expect(ud.fbp).toBe('fb.1.1596403881668.1116446470.ABcDEFGh')
    expect(ud.fbc).toBe('fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890.ABcDEFGh')
    expect(ud.external_id).toEqual([sha256('sf_123')])
  })

  it('skips fetch entirely when META_CAPI_DISABLE_SERVER_PURCHASE=1', async () => {
    vi.stubEnv('META_CAPI_DISABLE_SERVER_PURCHASE', '1')
    const { sendServerPurchase } = await importFreshModule()
    const result = await sendServerPurchase({
      orderId: 'KILLED',
      shipping: { email: 'buyer@example.com' },
      totalPrice: 100,
      currency: 'RON',
      contentIds: ['furniture__oslo-nightstand'],
      numItems: 1,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/KILLED',
      marketingConsent: true,
    })
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('skips fetch when marketingConsent is false (GDPR gate)', async () => {
    const { sendServerPurchase } = await importFreshModule()
    const result = await sendServerPurchase({
      orderId: 'NO-CONSENT',
      shipping: { email: 'buyer@example.com' },
      totalPrice: 100,
      currency: 'RON',
      contentIds: ['furniture__oslo-nightstand'],
      numItems: 1,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/NO-CONSENT',
      marketingConsent: false,
    })
    expect(result.ok).toBe(false)
    expect(result.body).toMatchObject({ error: 'consent_denied_or_missing' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('skips fetch when marketingConsent is omitted (default-deny)', async () => {
    const { sendServerPurchase } = await importFreshModule()
    const result = await sendServerPurchase({
      orderId: 'LEGACY',
      shipping: { email: 'buyer@example.com' },
      totalPrice: 100,
      currency: 'RON',
      contentIds: ['furniture__oslo-nightstand'],
      numItems: 1,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/LEGACY',
    })
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends the RO market value+currency pair to the Graph payload', async () => {
    const { sendServerPurchase } = await importFreshModule()
    await sendServerPurchase({
      orderId: 'C1',
      shipping: { email: 'a@b.co' },
      totalPrice: 480,
      currency: 'RON',
      contentIds: ['x'],
      numItems: 1,
      eventSourceUrl: 'https://ro.shop.example.com/confirmare/C1',
      marketingConsent: true,
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.data[0].custom_data).toMatchObject({ value: 480, currency: 'RON' })
  })

  it('sends the FR market value+currency pair to the Graph payload (EUR is never rewritten to RON)', async () => {
    const { sendServerPurchase } = await importFreshModule()
    await sendServerPurchase({
      orderId: 'C2',
      shipping: { email: 'a@b.co', country: 'France' },
      totalPrice: 250,
      currency: 'EUR',
      contentIds: ['x'],
      numItems: 1,
      eventSourceUrl: 'https://shop.example.com/confirmare/C2',
      marketingConsent: true,
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.data[0].custom_data).toMatchObject({ value: 250, currency: 'EUR' })
  })
})
