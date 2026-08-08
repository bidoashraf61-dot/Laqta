import type { Role } from '@prisma/client'

/**
 * The one place navigation is declared.
 *
 * Hrefs are locale-relative — always render them as `/${locale}${href}`, never
 * as bare paths, or the locale prefix is lost and middleware bounces the user
 * through a redirect on every click.
 *
 * Sessions 02–06 add their own in-section navigation inside their own route
 * folders. This file is the site-wide chrome only.
 */

export type NavItem = {
  href: string
  /** Dot-path into messages/*.json. */
  labelKey: string
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/footage', labelKey: 'nav.footage' },
  { href: '/albums', labelKey: 'nav.albums' },
  { href: '/collections', labelKey: 'nav.collections' },
  { href: '/creators', labelKey: 'nav.creators' },
]

export const ACCOUNT_NAV: NavItem[] = [
  { href: '/account', labelKey: 'nav.account' },
  { href: '/account/library', labelKey: 'nav.library' },
  { href: '/account/boards', labelKey: 'nav.boards' },
  { href: '/account/orders', labelKey: 'nav.orders' },
]

export const FOOTER_LEGAL: NavItem[] = [
  { href: '/about', labelKey: 'footer.about' },
  { href: '/contact', labelKey: 'footer.contact' },
  { href: '/terms', labelKey: 'footer.terms' },
  { href: '/privacy', labelKey: 'footer.privacy' },
  { href: '/licences', labelKey: 'footer.licences' },
  { href: '/content-policy', labelKey: 'footer.contentPolicy' },
  { href: '/refunds', labelKey: 'footer.refunds' },
]

/** Role-gated entries — the studio and admin links only appear when usable. */
export function roleNav(role: Role | undefined): NavItem[] {
  if (role === 'admin') {
    return [
      { href: '/studio', labelKey: 'nav.studio' },
      { href: '/admin', labelKey: 'nav.admin' },
    ]
  }
  if (role === 'creator') return [{ href: '/studio', labelKey: 'nav.studio' }]
  return [{ href: '/sell', labelKey: 'nav.sell' }]
}
