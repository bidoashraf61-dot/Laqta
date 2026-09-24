import { describe, expect, it } from 'vitest'
import { sampleRate, scrubEvent, scrubText, sentryOptions, stripQuery } from '@/lib/observability'

describe('scrubText', () => {
  it('masks emails, IPs and phone numbers', () => {
    expect(scrubText('user a.b@example.com failed')).toBe('user [email] failed')
    expect(scrubText('from 192.168.1.20')).toBe('from [ip]')
    expect(scrubText('from 2001:db8:85a3::8a2e:370:7334')).not.toContain('2001:db8')
    expect(scrubText('otp for +966 55 123 4567')).toBe('otp for [phone]')
  })
})

describe('stripQuery', () => {
  it('drops the query and fragment', () => {
    expect(stripQuery('https://laqta.sa/footage?q=العلا#x')).toBe('https://laqta.sa/footage')
    expect(stripQuery('/albums')).toBe('/albums')
  })
})

describe('scrubEvent', () => {
  it('removes the user, cookies, body, query and unsafe headers', () => {
    const event = scrubEvent({
      user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
      request: {
        url: 'https://laqta.sa/verify?token=abc&email=a@b.co',
        query_string: 'token=abc',
        cookies: { session: 'x' },
        data: { password: 'p' },
        headers: {
          Cookie: 'session=x',
          Authorization: 'Bearer y',
          'X-Forwarded-For': '1.2.3.4',
          'User-Agent': 'Safari',
          Referer: 'https://laqta.sa/footage?q=secret',
        },
      },
      message: 'Order for a@b.co failed',
      exception: { values: [{ value: 'No account for +201001234567' }] },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/x?email=a@b.co', body: '{}' } }],
      extra: { note: 'contact a@b.co' },
    })

    expect(event.user).toEqual({})
    expect(event.request).toEqual({
      url: 'https://laqta.sa/verify',
      headers: { 'User-Agent': 'Safari', Referer: 'https://laqta.sa/footage' },
    })
    expect(event.message).toBe('Order for [email] failed')
    expect(event.exception?.values?.[0].value).toBe('No account for [phone]')
    expect(event.breadcrumbs?.[0].data).toEqual({ url: '/api/x' })
    expect(event.extra?.note).toBe('contact [email]')
  })

  it('never drops an event', () => {
    expect(scrubEvent({})).toEqual({})
  })
})

describe('sentryOptions', () => {
  it('is inert without a DSN', () => {
    const o = sentryOptions(undefined, undefined)
    expect(o.enabled).toBe(false)
    expect(o.dsn).toBeUndefined()
    expect(o.tracesSampleRate).toBe(0)
    expect(o.sendDefaultPii).toBe(false)
  })

  it('enables with a DSN and clamps the trace rate', () => {
    const o = sentryOptions('https://k@o1.ingest.sentry.io/1', '5')
    expect(o.enabled).toBe(true)
    expect(o.tracesSampleRate).toBe(1)
    expect(sampleRate('0.1')).toBe(0.1)
    expect(sampleRate('nope')).toBe(0)
  })
})
