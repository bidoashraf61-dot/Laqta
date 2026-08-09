/**
 * Brand entity facts, in one place.
 *
 * `SOCIAL` is read by BOTH the footer and the Organization `sameAs` block. It
 * lived only in the footer, which meant the entity graph had no profile links
 * at all — the single most common GEO failure, and the thing that lets an AI
 * engine bind "لقطة" to an actual entity rather than treating it as a phrase.
 * Two copies of this list would drift the first time an account moved.
 */
export const SOCIAL = [
  { href: 'https://x.com/laqta_sa', label: 'X' },
  { href: 'https://instagram.com/laqta.sa', label: 'Instagram' },
  { href: 'https://youtube.com/@laqta', label: 'YouTube' },
  { href: 'https://linkedin.com/company/laqta', label: 'LinkedIn' },
] as const

/**
 * The logo, for schema.org and share cards.
 *
 * INTERIM. `docs/design-language.md` records the real logo as an open item —
 * the wordmark is still live text, which is why the favicon, the OG image and
 * the invoice header have all been blocked on it. This is a render of that
 * wordmark at 512², enough to satisfy `Organization.logo` (which wants ≥112²)
 * and stop the entity block failing validation. Replace it, do not build on it.
 */
export const LOGO_PATH = '/brand/laqta-logo.png'
export const LOGO_SIZE = 512
