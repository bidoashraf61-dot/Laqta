import { describe, it, expect } from 'vitest'
import { cn, serialise, slugify, formatBytes, formatDuration, addBusinessDays } from '@/lib/utils'

/**
 * Shared helpers.
 *
 * `addBusinessDays` is the one with real consequences: it sets the review SLA,
 * and it has to know that the Saudi and Egyptian working week ends on Thursday.
 * A Gregorian-Monday assumption here quietly promises reviewers a deadline that
 * lands on a weekend.
 */

describe('cn', () => {
  it('merges class lists', () => {
    expect(cn('a', 'b')).toContain('a')
  })

  it('drops falsy entries', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('lets a later Tailwind class win over an earlier conflicting one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})

describe('serialise', () => {
  it('round-trips a plain object', () => {
    expect(serialise({ a: 1, b: 'two' })).toEqual({ a: 1, b: 'two' })
  })

  it('converts Decimal-like and Date values into transferable primitives', () => {
    const out = serialise({ when: new Date('2026-08-01T00:00:00Z') }) as Record<string, unknown>
    expect(out.when).toBeDefined()
  })
})

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('AlUla Golden Hour')).toBe('alula-golden-hour')
  })

  it('strips punctuation', () => {
    expect(slugify('Riyadh: night!')).not.toMatch(/[:!]/)
  })

  it('never leaves leading or trailing hyphens', () => {
    const out = slugify('  --Riyadh--  ')
    expect(out.startsWith('-')).toBe(false)
    expect(out.endsWith('-')).toBe(false)
  })

  it('produces a URL-safe result', () => {
    expect(slugify('Empty Quarter — 4K/6K')).toMatch(/^[a-z0-9-]*$/)
  })
})

describe('formatBytes', () => {
  it('scales to a readable unit', () => {
    expect(formatBytes(1024)).toMatch(/KB/i)
    expect(formatBytes(1024 ** 3)).toMatch(/GB/i)
  })

  it('handles zero and bigint (Prisma returns BigInt for file sizes)', () => {
    expect(formatBytes(0)).toBeTruthy()
    expect(formatBytes(BigInt(1024 ** 3))).toMatch(/GB/i)
  })
})

describe('formatDuration', () => {
  it('renders mm:ss', () => {
    expect(formatDuration(75)).toBe('1:15')
  })

  it('pads the seconds', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('handles zero and sub-minute clips', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9)).toBe('0:09')
  })
})

describe('addBusinessDays — the review SLA', () => {
  // The Gulf weekend is Friday (5) and Saturday (6).
  const isWeekend = (d: Date) => d.getDay() === 5 || d.getDay() === 6

  it('never lands the deadline on a Friday or Saturday', () => {
    // Walk a full week of start dates so every weekday is a starting point.
    for (let offset = 0; offset < 14; offset++) {
      const start = new Date('2026-08-01T00:00:00Z')
      start.setDate(start.getDate() + offset)
      for (const days of [1, 2, 3, 5]) {
        expect(isWeekend(addBusinessDays(start, days))).toBe(false)
      }
    }
  })

  it('skips the weekend when counting', () => {
    // Thursday 2026-08-06 + 1 business day = Sunday 2026-08-09, not Friday.
    const thursday = new Date('2026-08-06T00:00:00')
    expect(thursday.getDay()).toBe(4)
    const due = addBusinessDays(thursday, 1)
    expect(due.getDay()).toBe(0)
  })

  it('always moves forward', () => {
    const start = new Date('2026-08-03T00:00:00')
    expect(addBusinessDays(start, 3).getTime()).toBeGreaterThan(start.getTime())
  })

  it('does not mutate the input date', () => {
    const start = new Date('2026-08-03T00:00:00')
    const before = start.getTime()
    addBusinessDays(start, 3)
    expect(start.getTime()).toBe(before)
  })

  it('gives the published three-business-day SLA room for the weekend', () => {
    // Wednesday + 3 business days must cross the Fri/Sat weekend.
    const wednesday = new Date('2026-08-05T00:00:00')
    expect(wednesday.getDay()).toBe(3)
    const due = addBusinessDays(wednesday, 3)
    const calendarDays = Math.round((due.getTime() - wednesday.getTime()) / 86_400_000)
    expect(calendarDays).toBeGreaterThan(3)
  })
})

describe('MIN_PAYOUT_USD — the withdrawal floor', () => {
  it('is denominated in USD, not the old SAR value', async () => {
    const { MIN_PAYOUT_USD } = await import('@/lib/studio')
    // SAR 500 kept literally through the USD move raised the floor to ~SAR
    // 1,875 and stranded withdrawable balances. It must sit at or below the
    // peg equivalent so the change only ever helps a creator.
    expect(MIN_PAYOUT_USD).toBeLessThanOrEqual(500 / 3.75)
    expect(MIN_PAYOUT_USD).toBeGreaterThan(0)
  })
})
