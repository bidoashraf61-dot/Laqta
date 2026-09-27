import { beforeEach, describe, expect, it } from 'vitest'
import { clear, clientIp, hit, limitKey, limitsNetwork, resetAllLimits } from '@/lib/rate-limit'

describe('rate limiter (DEV-48)', () => {
  beforeEach(() => resetAllLimits())

  it('allows up to the limit in a window, then refuses with a retry time', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) expect(hit('b', 'k', 3, 60_000, now).ok).toBe(true)
    const refused = hit('b', 'k', 3, 60_000, now + 10_000)
    expect(refused.ok).toBe(false)
    expect(refused.retryAfterS).toBe(50)
  })

  it('opens again when the window resets', () => {
    for (let i = 0; i < 4; i++) hit('b', 'k', 3, 60_000, 0)
    expect(hit('b', 'k', 3, 60_000, 60_001).ok).toBe(true)
  })

  it('keeps buckets and keys apart, and clear() forgets one', () => {
    for (let i = 0; i < 3; i++) hit('a', 'k', 3, 60_000, 0)
    expect(hit('a', 'k', 3, 60_000, 1).ok).toBe(false)
    expect(hit('b', 'k', 3, 60_000, 1).ok).toBe(true)
    expect(hit('a', 'other', 3, 60_000, 1).ok).toBe(true)
    clear('a', 'k')
    expect(hit('a', 'k', 3, 60_000, 2).ok).toBe(true)
  })

  it('hashes keys — no raw email or IP is kept', () => {
    expect(limitKey('someone@example.com')).toMatch(/^[0-9a-f]{32}$/)
    expect(limitKey('someone@example.com')).not.toContain('someone')
  })

  it('reads the first forwarded address and exempts loopback from network limits', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })
    expect(clientIp(headers)).toBe('203.0.113.9')
    expect(clientIp(new Headers())).toBe('unknown')
    expect(limitsNetwork('203.0.113.9')).toBe(true)
    expect(limitsNetwork('127.0.0.1')).toBe(false)
    expect(limitsNetwork('unknown')).toBe(false)
  })
})
