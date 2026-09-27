import { describe, expect, it } from 'vitest'
import { faqInLocale, hubFaqsFromForm, parseHubFaqs } from '@/lib/hub-page'

const form = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

describe('hub page text (DEV-41)', () => {
  it('reads up to three complete FAQs from the form, skipping empty slots', () => {
    const { faqs, incomplete } = hubFaqsFromForm(
      form({ faq1QAr: 'س١', faq1AAr: 'ج١', faq3QAr: 'س٣', faq3AAr: 'ج٣', faq3QEn: 'Q3', faq3AEn: 'A3' }),
    )
    expect(incomplete).toBe(false)
    expect(faqs).toHaveLength(2)
    expect(faqs[1]).toEqual({ qAr: 'س٣', aAr: 'ج٣', qEn: 'Q3', aEn: 'A3' })
  })

  it('refuses a question without its answer, or half an English pair', () => {
    expect(hubFaqsFromForm(form({ faq1QAr: 'س' })).incomplete).toBe(true)
    expect(hubFaqsFromForm(form({ faq1QAr: 'س', faq1AAr: 'ج', faq1QEn: 'Q' })).incomplete).toBe(true)
  })

  it('distrusts the stored column', () => {
    expect(parseHubFaqs(null)).toEqual([])
    expect(parseHubFaqs('nope')).toEqual([])
    expect(parseHubFaqs([{ qAr: 'س' }, { qAr: 'س', aAr: 'ج' }, 7])).toHaveLength(1)
    expect(parseHubFaqs(Array.from({ length: 5 }, () => ({ qAr: 'س', aAr: 'ج' })))).toHaveLength(3)
  })

  it('shows the English pair only when both halves exist, else the Arabic pair', () => {
    expect(faqInLocale({ qAr: 'س', aAr: 'ج', qEn: 'Q', aEn: 'A' }, 'en')).toEqual({ q: 'Q', a: 'A' })
    expect(faqInLocale({ qAr: 'س', aAr: 'ج', qEn: '', aEn: '' }, 'en')).toEqual({ q: 'س', a: 'ج' })
    expect(faqInLocale({ qAr: 'س', aAr: 'ج', qEn: 'Q', aEn: 'A' }, 'ar')).toEqual({ q: 'س', a: 'ج' })
  })
})
