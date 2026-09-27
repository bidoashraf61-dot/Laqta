import type { ComponentType, SVGProps } from 'react'
import {
  FileText,
  Gauge,
  Image,
  Inbox,
  Layers,
  Receipt,
  Sparkles,
  Users,
} from 'lucide-react'
import * as Laqta from '@/components/ui/icons'

/**
 * Dashboard navigation.
 *
 * The single source of truth for both the creator and the admin sidebars.
 * Grouped so the rail reads as sections, not a flat wall of links — a control
 * panel that a non-technical operator can scan by area (overview, content,
 * money, settings) rather than hunt through.
 *
 * `labelKey` is a messages dot-path; hrefs are absolute. Icons are the Laqta
 * set where the slot names a domain object — a clip, a creator, a licence —
 * and lucide where it names an interface idea a custom mark would only make
 * slower to read (a gauge, a receipt, a sparkle).
 */

export type DashboardLink = {
  href: string
  labelKey: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Marks the section landing so nested routes still highlight it. */
  exact?: boolean
}

export type DashboardSection = {
  titleKey: string
  links: DashboardLink[]
}

/**
 * Which nav a shell renders.
 *
 * The shell takes this STRING, not the section array. `DashboardLink.icon` is
 * a React component, and a component cannot cross the server→client boundary
 * as a prop — React refuses to serialize it and the whole subtree renders its
 * error boundary instead. Passing a discriminator and resolving it inside the
 * client sidebar keeps one source of truth and stays serializable.
 */
export type DashboardNav = 'studio' | 'admin'

/** Creator studio. */
export const STUDIO_NAV: DashboardSection[] = [
  {
    titleKey: 'dash.sectionOverview',
    links: [
      { href: '/studio', labelKey: 'dash.overview', icon: Gauge, exact: true },
      { href: '/studio/analytics', labelKey: 'dash.analytics', icon: Laqta.Analytics },
    ],
  },
  {
    titleKey: 'dash.sectionContent',
    links: [
      { href: '/studio/albums', labelKey: 'studio.albums', icon: Laqta.Album },
      { href: '/studio/releases', labelKey: 'studio.releases', icon: Laqta.Licence },
    ],
  },
  {
    titleKey: 'dash.sectionMoney',
    links: [
      { href: '/studio/earnings', labelKey: 'studio.earnings', icon: Laqta.Chest },
      { href: '/studio/payouts', labelKey: 'dash.payouts', icon: Receipt },
    ],
  },
  {
    titleKey: 'dash.sectionSettings',
    links: [{ href: '/studio/settings', labelKey: 'dash.settings', icon: Laqta.Settings }],
  },
]

/** Admin control panel. */
export const ADMIN_NAV: DashboardSection[] = [
  {
    titleKey: 'dash.sectionOverview',
    links: [
      { href: '/admin', labelKey: 'dash.overview', icon: Gauge, exact: true },
      { href: '/admin/analytics', labelKey: 'dash.analytics', icon: Laqta.Analytics },
    ],
  },
  {
    titleKey: 'dash.sectionOperations',
    links: [
      { href: '/admin/review', labelKey: 'admin.reviewQueue', icon: Laqta.Cleared },
      { href: '/admin/users', labelKey: 'dash.usersTitle', icon: Users },
      { href: '/admin/creators', labelKey: 'admin.creators', icon: Laqta.Creator },
      { href: '/admin/disputes', labelKey: 'admin.disputes', icon: Laqta.Dispute },
      { href: '/admin/requests', labelKey: 'request.adminTitle', icon: Laqta.Search },
      { href: '/admin/waitlist', labelKey: 'dash.waitlistTitle', icon: Inbox },
      { href: '/admin/blog', labelKey: 'dash.blogTitle', icon: FileText },
      { href: '/admin/messages', labelKey: 'dash.messagesTitle', icon: Inbox },
    ],
  },
  {
    titleKey: 'dash.sectionCatalogue',
    links: [
      { href: '/admin/catalogue', labelKey: 'admin.catalogue', icon: Laqta.Clip },
      { href: '/admin/taxonomy', labelKey: 'admin.taxonomyEditor', icon: Laqta.Category },
      { href: '/admin/merchandising', labelKey: 'dash.merchandising', icon: Image },
      { href: '/admin/reports', labelKey: 'admin.zeroResults', icon: Laqta.Search },
    ],
  },
  {
    titleKey: 'dash.sectionMoney',
    links: [
      { href: '/admin/orders', labelKey: 'admin.orders', icon: Laqta.Basket },
      { href: '/admin/payouts', labelKey: 'admin.payoutRuns', icon: Laqta.Chest },
      { href: '/admin/promos', labelKey: 'dash.promos', icon: Sparkles },
      { href: '/admin/bundles', labelKey: 'dash.bundles.nav', icon: Layers },
    ],
  },
  {
    titleKey: 'dash.sectionSettings',
    links: [
      { href: '/admin/content', labelKey: 'dash.docs.nav', icon: FileText },
      { href: '/admin/settings', labelKey: 'dash.settings', icon: Laqta.Settings },
    ],
  },
]

/** Resolve a nav name to its sections, on whichever side of the boundary. */
export function navSections(nav: DashboardNav): DashboardSection[] {
  return nav === 'admin' ? ADMIN_NAV : STUDIO_NAV
}
