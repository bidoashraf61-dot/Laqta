/**
 * The owner-written text of a location or category hub (DEV-41): an intro
 * paragraph and up to three questions and answers, in both languages. Stored
 * on `Taxonomy.introAr/introEn/faqs`. This module owns the FAQ shape — the
 * JSON column is read through `parseHubFaqs` and written through
 * `hubFaqsFromForm`, so a malformed row can never reach a page.
 */

export const HUB_FAQ_MAX = 3
export const HUB_INTRO_MAX = 1500
const Q_MAX = 200
const A_MAX = 700

export type HubFaq = { qAr: string; aAr: string; qEn: string; aEn: string }

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** Distrust the column: keep only complete-enough entries (an Arabic pair at least). */
export function parseHubFaqs(value: unknown): HubFaq[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, HUB_FAQ_MAX)
    .map((raw) => {
      const row = (raw ?? {}) as Record<string, unknown>
      return { qAr: text(row.qAr, Q_MAX), aAr: text(row.aAr, A_MAX), qEn: text(row.qEn, Q_MAX), aEn: text(row.aEn, A_MAX) }
    })
    .filter((row) => row.qAr && row.aAr)
}

/** `faq1QAr`, `faq1AAr`, `faq1QEn`, `faq1AEn` … `faq3*` from the admin form. */
export function hubFaqsFromForm(form: FormData): { faqs: HubFaq[]; incomplete: boolean } {
  const faqs: HubFaq[] = []
  let incomplete = false
  for (let i = 1; i <= HUB_FAQ_MAX; i++) {
    const row = {
      qAr: text(form.get(`faq${i}QAr`), Q_MAX),
      aAr: text(form.get(`faq${i}AAr`), A_MAX),
      qEn: text(form.get(`faq${i}QEn`), Q_MAX),
      aEn: text(form.get(`faq${i}AEn`), A_MAX),
    }
    const filled = Object.values(row).filter(Boolean).length
    if (filled === 0) continue
    // A question without its answer (in Arabic at least) would render as a
    // dangling heading and a FAQPage entry Google rejects.
    if (!row.qAr || !row.aAr || Boolean(row.qEn) !== Boolean(row.aEn)) incomplete = true
    faqs.push(row)
  }
  return { faqs, incomplete }
}

/** The pair in the reader's language, falling back to Arabic as a whole pair. */
export function faqInLocale(faq: HubFaq, locale: 'ar' | 'en') {
  return locale === 'en' && faq.qEn && faq.aEn ? { q: faq.qEn, a: faq.aEn } : { q: faq.qAr, a: faq.aAr }
}
