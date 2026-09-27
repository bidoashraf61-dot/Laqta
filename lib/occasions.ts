/**
 * Occasion pages (DEV-42): `/occasions/[slug]`, one per campaign season a
 * Saudi brief is built around. Each is a `theme` taxonomy term (seeded in
 * prisma/seed-base.ts, THEMES) rendered by the same hub as locations and
 * categories. Only these five have a page — the other themes (Hajj and Umrah,
 * Winter at Tantora) stay search facets: the first touches holy sites the
 * catalogue does not carry.
 */
export const OCCASION_SLUGS = ['ramadan', 'eid', 'founding-day', 'national-day', 'riyadh-season'] as const
export type OccasionSlug = (typeof OCCASION_SLUGS)[number]

export const isOccasion = (slug: string): slug is OccasionSlug => (OCCASION_SLUGS as readonly string[]).includes(slug)
