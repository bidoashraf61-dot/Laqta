import { stripKashida } from '@/lib/arabic'

/**
 * FAQPage JSON-LD.
 *
 * ── Why it is generated from the same keys the page renders ─────────────────
 * Google requires the marked-up answer to match the visible answer. Hand-
 * writing the schema separately guarantees they drift the first time someone
 * edits the copy and forgets the duplicate — and a mismatch is treated as
 * spam, not as a typo. Both the component and this block read the same
 * dictionary keys, so they cannot disagree.
 *
 * Kashida is stripped: U+0640 is a rendering device for headlines, and a
 * search engine comparing the marked-up string against the rendered one should
 * not see elongation characters in between.
 */
export function FaqSchema({ pairs }: { pairs: Array<{ q: string; a: string }> }) {
  if (pairs.length === 0) return null

  const json = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'ar-SA',
    mainEntity: pairs.map(({ q, a }) => ({
      '@type': 'Question',
      name: stripKashida(q),
      acceptedAnswer: { '@type': 'Answer', text: stripKashida(a) },
    })),
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  )
}
