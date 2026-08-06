import { describe, it, expect } from 'vitest'
import {
  t,
  formatMoney,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  normaliseArabic,
  isArabic,
  locale,
  direction,
} from '@/lib/i18n'

/**
 * Copy and formatting.
 *
 * Two classes of bug live here and both have shipped before:
 *   1. A missing dictionary key rendering as a raw dot-path on screen.
 *   2. Bidi corruption — `ar-SA` wraps dates and currency in U+200F marks, and
 *      inside the LTR-isolated span every number lives in, those marks reorder
 *      the segments ("01/08/2026" became "012026/08/"). That one reached
 *      production on every dated surface, so it is pinned hard.
 */

const BIDI = /[‎‏؜]/

describe('locale contract', () => {
  it('is Arabic, RTL', () => {
    expect(locale).toBe('ar')
    expect(direction).toBe('rtl')
  })
})

describe('t()', () => {
  it('resolves a dot-path', () => {
    expect(t('brand.name')).toBe('لقطة')
  })

  it('returns the key itself when missing, so a gap is loud', () => {
    expect(t('does.not.exist')).toBe('does.not.exist')
  })

  it('interpolates named placeholders', () => {
    expect(t('commerce.fromAlbum', { album: 'العلا' })).toContain('العلا')
  })

  it('leaves an unfilled placeholder visible rather than blank', () => {
    expect(t('commerce.fromAlbum')).toContain('{album}')
  })

  it('never returns an object for a branch node', () => {
    // 'brand' is a group, not a string — asking for it must not leak "[object Object]".
    expect(t('brand')).toBe('brand')
  })
})

describe('formatDate — the bidi regression', () => {
  const date = new Date('2026-08-01T00:00:00Z')

  it('renders day/month/year in Latin digits', () => {
    expect(formatDate(date)).toBe('01/08/2026')
  })

  it('carries NO directional marks', () => {
    expect(BIDI.test(formatDate(date))).toBe(false)
  })

  it('does not scramble segments (the 012026/08/ bug)', () => {
    const out = formatDate(date)
    expect(out).not.toMatch(/^\d{6}/)
    expect(out.split('/')).toHaveLength(3)
    expect(out.endsWith('/')).toBe(false)
  })

  it('accepts an ISO string as well as a Date', () => {
    expect(formatDate('2026-08-01T00:00:00Z')).toBe(formatDate(date))
  })

  it('applies the same hygiene to formatDateTime', () => {
    expect(BIDI.test(formatDateTime(date))).toBe(false)
  })
})

describe('formatMoney', () => {
  it('defaults to USD', () => {
    expect(formatMoney(399)).toContain('399')
    expect(formatMoney(399)).toMatch(/US\$|\$/)
  })

  it('carries no directional marks', () => {
    expect(BIDI.test(formatMoney(1197))).toBe(false)
  })

  it('groups thousands', () => {
    expect(formatMoney(1197)).toContain('1,197')
  })

  it('honours an explicit currency', () => {
    expect(formatMoney(100, 'SAR')).toMatch(/SAR|﷼|ر\.س/)
  })

  it('renders zero rather than blank', () => {
    expect(formatMoney(0)).toContain('0')
  })

  it('coerces a numeric string (Prisma Decimal comes through as one)', () => {
    expect(formatMoney('399')).toBe(formatMoney(399))
  })

  it('never renders NaN to a buyer', () => {
    expect(formatMoney(Number.NaN)).toContain('0')
    expect(formatMoney('not-a-number')).toContain('0')
  })
})

describe('formatNumber / formatPercent', () => {
  it('uses Latin digits for counts', () => {
    expect(formatNumber(1234)).toBe('1,234')
  })

  it('formats a fraction as a percentage', () => {
    expect(formatPercent(0.75, 0)).toContain('75')
  })
})

describe('normaliseArabic — search folding', () => {
  it('folds the hamza family', () => {
    expect(normaliseArabic('أحمد')).toBe(normaliseArabic('احمد'))
    expect(normaliseArabic('إبراهيم')).toBe(normaliseArabic('ابراهيم'))
  })

  it('strips diacritics', () => {
    expect(normaliseArabic('أَحْمَد')).toBe(normaliseArabic('احمد'))
  })

  it('folds teh marbuta to heh', () => {
    expect(normaliseArabic('جدة')).toBe(normaliseArabic('جده'))
  })

  it('folds alef maqsura to yaa', () => {
    expect(normaliseArabic('العلى')).toBe(normaliseArabic('العلي'))
  })

  it('strips tatweel', () => {
    expect(normaliseArabic('محـــمد')).toBe(normaliseArabic('محمد'))
  })

  it('is idempotent — folding twice changes nothing', () => {
    const once = normaliseArabic('أَحْمَد جدة العلى')
    expect(normaliseArabic(once)).toBe(once)
  })

  it('lowercases Latin so a transliteration matches case-insensitively', () => {
    // "AlUla" and "alula" must fold together — the synonym layer maps the
    // Latin transliteration to العلا, and buyers type it every which way.
    expect(normaliseArabic('AlUla 4K')).toBe(normaliseArabic('alula 4k'))
    expect(normaliseArabic('AlUla')).toContain('alula')
  })
})

describe('isArabic', () => {
  it('detects Arabic script', () => {
    expect(isArabic('الرياض')).toBe(true)
  })

  it('rejects pure Latin', () => {
    expect(isArabic('Riyadh')).toBe(false)
  })
})
