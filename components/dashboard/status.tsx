import { Badge, type BadgeProps } from '@/components/ui/badge'
import { t } from '@/lib/i18n'

/**
 * Status vocabulary.
 *
 * Every status in the product resolves to a label and a badge variant in one
 * place, so "live" is the same green in the studio, the admin catalogue and
 * the review queue. Operate mode's consistency rule, made mechanical: a page
 * cannot invent its own colour for a state because it never picks one.
 *
 * The Status-Only Colour Rule applies — oasis/clay/destructive are signal,
 * never decoration, so most states are deliberately neutral. Only the states
 * that actually demand an eye (failed, overdue, live, paid) take a hue.
 */

type StatusMap = Record<string, { key: string; variant: NonNullable<BadgeProps['variant']> }>

const ALBUM: StatusMap = {
  draft: { key: 'studio.draft', variant: 'neutral' },
  in_review: { key: 'studio.inReview', variant: 'warning' },
  changes_requested: { key: 'studio.changesRequested', variant: 'warning' },
  live: { key: 'studio.live', variant: 'success' },
  paused: { key: 'studio.paused', variant: 'neutral' },
  delisted: { key: 'studio.delisted', variant: 'destructive' },
}

const REVIEW: StatusMap = {
  unassigned: { key: 'dash.unassigned', variant: 'warning' },
  assigned: { key: 'dash.assignedTo', variant: 'neutral' },
  in_progress: { key: 'dash.assignedTo', variant: 'neutral' },
  approved: { key: 'admin.approved', variant: 'success' },
  changes_requested: { key: 'studio.changesRequested', variant: 'warning' },
  rejected: { key: 'admin.rejected', variant: 'destructive' },
}

const CREATOR: StatusMap = {
  pending: { key: 'dash.creatorPending', variant: 'warning' },
  approved: { key: 'dash.creatorApproved', variant: 'success' },
  suspended: { key: 'dash.creatorSuspended', variant: 'destructive' },
  rejected: { key: 'dash.creatorRejected', variant: 'neutral' },
}

const PAYOUT: StatusMap = {
  requested: { key: 'dash.statusRequested', variant: 'warning' },
  approved: { key: 'dash.statusApproved', variant: 'neutral' },
  processing: { key: 'dash.statusProcessing', variant: 'neutral' },
  paid: { key: 'dash.statusPaid', variant: 'success' },
  failed: { key: 'dash.statusFailed', variant: 'destructive' },
}

const ORDER: StatusMap = {
  pending: { key: 'dash.orderPending', variant: 'warning' },
  paid: { key: 'dash.orderPaid', variant: 'success' },
  failed: { key: 'dash.orderFailed', variant: 'destructive' },
  refunded: { key: 'dash.orderRefunded', variant: 'neutral' },
  partially_refunded: { key: 'dash.orderPartial', variant: 'neutral' },
}

const DISPUTE: StatusMap = {
  open: { key: 'dash.disputeOpen', variant: 'warning' },
  investigating: { key: 'dash.disputeInvestigating', variant: 'warning' },
  content_disabled: { key: 'dash.disputeDisabled', variant: 'destructive' },
  resolved: { key: 'dash.disputeResolved', variant: 'success' },
  rejected: { key: 'dash.disputeRejected', variant: 'neutral' },
}

const RELEASE: StatusMap = {
  pending: { key: 'dash.releasePending', variant: 'warning' },
  verified: { key: 'dash.releaseVerified', variant: 'success' },
  rejected: { key: 'dash.releaseRejected', variant: 'destructive' },
}

const MAPS = {
  album: ALBUM,
  review: REVIEW,
  creator: CREATOR,
  payout: PAYOUT,
  order: ORDER,
  dispute: DISPUTE,
  release: RELEASE,
} as const

export type StatusDomain = keyof typeof MAPS

/** The single status badge. Unknown values degrade to a neutral raw label. */
export function StatusBadge({
  domain,
  value,
  className,
}: {
  domain: StatusDomain
  value: string
  className?: string
}) {
  const entry = MAPS[domain][value]
  return (
    <Badge variant={entry?.variant ?? 'neutral'} className={className}>
      {entry ? t(entry.key) : value}
    </Badge>
  )
}

/** The label alone, for a filter chip or a select option. */
export function statusLabel(domain: StatusDomain, value: string) {
  const entry = MAPS[domain][value]
  return entry ? t(entry.key) : value
}

/** Every value in a domain, in the order the filter row should show them. */
export function statusValues(domain: StatusDomain) {
  return Object.keys(MAPS[domain])
}
