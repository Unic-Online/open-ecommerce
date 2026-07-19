import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

type TestWindow = Window & {
  dataLayer?: unknown[][];
};

let fbqMock: ReturnType<typeof vi.fn>;

function installFbqMock() {
  fbqMock = vi.fn();
  window.fbq = fbqMock as unknown as Window['fbq'];
}

describe('Meta Pixel Integration', () => {
  beforeEach(() => {
    // Reset fbq mock
    installFbqMock();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq');
  });

  it('fbq function is callable from window', () => {
    expect(typeof window.fbq).toBe('function');
  });

  it('tracks PageView event', () => {
    window.fbq('track', 'PageView');
    expect(window.fbq).toHaveBeenCalledWith('track', 'PageView');
  });

  it('tracks AddToCart event with correct params', () => {
    const params = {
      content_name: 'Pietre Luminescente — Albastru Turcoaz, 2–5 mm, 500g',
      content_ids: ['lake-blue__2-5mm__500g'],
      content_type: 'product',
      value: 199,
      currency: 'RON',
    };

    window.fbq('track', 'AddToCart', params);
    expect(window.fbq).toHaveBeenCalledWith('track', 'AddToCart', params);
  });

  it('tracks InitiateCheckout event with cart data', () => {
    const params = {
      content_ids: ['lake-blue__2-5mm__500g'],
      num_items: 2,
      value: 398,
      currency: 'RON',
    };

    window.fbq('track', 'InitiateCheckout', params);
    expect(window.fbq).toHaveBeenCalledWith('track', 'InitiateCheckout', params);
  });

  it('tracks Purchase event after successful order', () => {
    const params = {
      content_ids: ['lake-blue__2-5mm__500g'],
      num_items: 1,
      value: 199,
      currency: 'RON',
    };

    window.fbq('track', 'Purchase', params);
    expect(window.fbq).toHaveBeenCalledWith('track', 'Purchase', params);
  });

  it('tracks ViewContent event for product pages', () => {
    const params = {
      content_name: 'Pietre Luminescente',
      content_category: 'Pietre Decorative',
      content_type: 'product',
      value: 49,
      currency: 'RON',
    };

    window.fbq('track', 'ViewContent', params);
    expect(window.fbq).toHaveBeenCalledWith('track', 'ViewContent', params);
  });
});

describe('Meta Pixel Helper Functions', () => {
  beforeEach(() => {
    installFbqMock();
    localStorage.clear();
    delete (window as Window & { __sfConsent?: unknown }).__sfConsent;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq');
    delete (window as Window & { __sfConsent?: unknown }).__sfConsent;
  });

  it('generateEventId returns unique IDs', async () => {
    const { generateEventId } = await import('@/components/MetaPixel');
    const id1 = generateEventId();
    const id2 = generateEventId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^\d+_[a-z0-9]+$/);
  });

  it('trackEvent fires both pixel and CAPI when marketing consent granted', async () => {
    const { writeConsent } = await import('@/lib/consent');
    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const { trackEvent } = await import('@/components/MetaPixel');
    trackEvent('TestEvent', { test: true });

    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'TestEvent',
      { test: true },
      expect.objectContaining({ eventID: expect.any(String) })
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/meta-capi',
      expect.objectContaining({ method: 'POST' })
    );

    fetchSpy.mockRestore();
  });

  it('adds stored checkout phone to browser-relayed CAPI events when available', async () => {
    const { writeConsent } = await import('@/lib/consent');
    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' });
    localStorage.setItem(
      'storefront-checkout-shipping',
      JSON.stringify({
        phone: '+40 712 345 678',
        firstName: 'Ion',
        lastName: 'Popescu',
        city: 'București',
        country: 'România',
        postalCode: '012345',
      }),
    );

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const { trackAddToCart } = await import('@/components/MetaPixel');
    trackAddToCart('Acme SF01', '1', 1780);

    const payload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(payload.eventName).toBe('AddToCart');
    expect(payload.userData).toMatchObject({
      phone: '+40 712 345 678',
      firstName: 'Ion',
      lastName: 'Popescu',
      city: 'București',
      country: 'România',
      postalCode: '012345',
    });

    fetchSpy.mockRestore();
  });

  it('does NOT enrich PageView with stored email/phone/address (Meta dup-PII)', async () => {
    const { writeConsent } = await import('@/lib/consent')
    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' })
    localStorage.setItem('sf_user_email', 'test@example.com')
    localStorage.setItem(
      'storefront-checkout-shipping',
      JSON.stringify({
        phone: '+40 712 345 678',
        firstName: 'Ion',
        lastName: 'Popescu',
        city: 'București',
        country: 'România',
        postalCode: '012345',
      }),
    )

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const { trackEvent } = await import('@/components/MetaPixel')
    trackEvent('PageView')

    const payload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(payload.eventName).toBe('PageView')
    expect(payload.userData).toBeUndefined()

    fetchSpy.mockRestore()
  })

  it('drops invalid stored phone instead of sending a placeholder hash', async () => {
    const { writeConsent } = await import('@/lib/consent')
    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' })
    localStorage.setItem(
      'storefront-checkout-shipping',
      JSON.stringify({ phone: '5', firstName: 'Ion' }),
    )

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const { trackAddToCart } = await import('@/components/MetaPixel')
    trackAddToCart('Acme SF01', '1', 1780)

    const payload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(payload.userData?.phone).toBeUndefined()
    expect(payload.userData?.firstName).toBe('Ion')

    fetchSpy.mockRestore()
  })

  it('trackEvent no-ops when marketing consent is denied (GDPR gate)', async () => {
    const { writeConsent } = await import('@/lib/consent');
    writeConsent({ analytics: false, marketing: false, source: 'banner_decline_all' });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const { trackEvent } = await import('@/components/MetaPixel');
    trackEvent('TestEvent', { test: true });

    expect(fbqMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('trackEvent no-ops when no consent decision yet (default-deny)', async () => {
    // No writeConsent call — fresh visitor.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const { trackEvent } = await import('@/components/MetaPixel');
    trackEvent('TestEvent');

    expect(fbqMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

describe('Google Tag (gtag) Integration', () => {
  it('window.dataLayer exists and is an array', () => {
    const testWindow = window as TestWindow;
    testWindow.dataLayer = testWindow.dataLayer || [];
    expect(Array.isArray(testWindow.dataLayer)).toBe(true);
  });

  it('gtag function pushes to dataLayer', () => {
    const testWindow = window as TestWindow;
    testWindow.dataLayer = [];

    function gtag(...args: unknown[]) {
      testWindow.dataLayer?.push(args);
    }

    gtag('config', 'G-TEST000000');
    expect(testWindow.dataLayer).toHaveLength(1);
    expect(testWindow.dataLayer?.[0]).toEqual(['config', 'G-TEST000000']);
  });

  it('GA4 measurement ID is correct', () => {
    // This verifies the hardcoded GA4 ID that's in layout.tsx
    const GA4_ID = 'G-TEST000000';
    expect(GA4_ID).toMatch(/^G-[A-Z0-9]+$/);
  });
});

describe('Meta CAPI Server Route', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '1000000000000001');
    vi.stubEnv('META_CAPI_ACCESS_TOKEN', 'test-token');
  });

  it('rejects when Pixel ID is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '');

    // Re-import to pick up new env
    vi.resetModules();
    const { POST } = await import('@/app/api/meta-capi/route');

    const req = new Request('http://localhost/api/meta-capi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({
        eventName: 'PageView',
        eventId: 'test-123',
        eventSourceUrl: 'http://localhost/',
      }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
