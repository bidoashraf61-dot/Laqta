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
  { href: 'https://instagram.com/laqta.sa', label: 'Instagram' },
  { href: 'https://tiktok.com/@laqta.sa', label: 'TikTok' },
  { href: 'https://youtube.com/@laqta', label: 'YouTube' },
] as const

/**
 * The logo. Approved artwork, no longer a placeholder.
 *
 * Two colourways of one mark, and which one is correct is a property of the
 * GROUND, not of a theme: `laqta-light` on ink, film and the olive band,
 * `laqta-dark` on paper and white cards. That is the same rule the rest of the
 * system follows — see "Grounds and inks travel together" in DESIGN.md — and
 * it is why `<Logo>` takes a tone rather than reading a theme.
 *
 * `LOGO_PATH` is what schema.org's `Organization.logo` and the share cards
 * point at. It has to be the version that survives being shown on an unknown
 * background in someone else's UI, which is the dark-on-light one: a chat
 * client or a search result is far more likely to be light.
 */
export const LOGO_PATH = '/brand/laqta-dark.png'
export const LOGO_SIZE = 512

/** The two colourways, by the ground they belong on. */
export const LOGO = {
  onLight: '/brand/laqta-dark.png',
  onDark: '/brand/laqta-light.png',
} as const
