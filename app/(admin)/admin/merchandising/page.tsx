import { Link } from '@/components/ui/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { ActionButton } from '@/components/dashboard/form'
import { SlotEditor, type SlotValue } from '@/components/admin/slot-editor'
import { toggleCollection, toggleSlotActive } from '@/app/(admin)/admin/actions'
import { formatDate, formatNumber, t } from '@/lib/i18n'
import { UserText } from '@/components/ui/bilingual'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('dash.merchandising'),
  }
}

/** `<input type="date">` needs `YYYY-MM-DD`, not a locale-formatted string. */
function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null
}

/**
 * Storefront merchandising.
 *
 * The homepage is data, not code: each slot carries its own copy, media, link
 * and scheduling window, and a collection publishes or features itself from
 * here. That is the difference between marketing running a launch and
 * marketing filing a ticket for a deploy.
 */
export default async function AdminMerchandisingPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  await requireAdmin()

  const [slots, collections] = await Promise.all([
    db.merchandisingSlot.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    db.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { titleAr: 'asc' }],
      include: { _count: { select: { albums: true } } },
    }),
  ])

  const now = new Date()

  return (
    <>
      <DashboardHeader
        title={t('dash.merchandisingTitle')}
        description={t('dash.merchandisingHint')}
      />

      <div className="space-y-6">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">{t('dash.sampleNav')}</h2>
              <p className="text-sm text-muted-foreground">{t('dash.sampleNavHint')}</p>
            </div>
            <a
              href="/admin/merchandising/sample"
              className="text-sm font-medium underline underline-offset-4 hover:text-gold"
            >
              {t('dash.sampleNav')}
            </a>
          </div>
        </Panel>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('dash.slots')}</h2>
          {slots.length === 0 ? (
            <EmptyState title={t('dash.noSlots')} description={t('dash.merchandisingHint')} />
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => {
                // A slot can be switched on and still be outside its window —
                // "active" alone would read as "showing", which it isn't.
                const scheduled =
                  (!slot.startsAt || slot.startsAt <= now) && (!slot.endsAt || slot.endsAt >= now)
                const value: SlotValue = {
                  id: slot.id,
                  key: slot.key,
                  titleAr: slot.titleAr,
                  titleEn: slot.titleEn,
                  subtitleAr: slot.subtitleAr,
                  subtitleEn: slot.subtitleEn,
                  ctaLabelAr: slot.ctaLabelAr,
                  ctaLabelEn: slot.ctaLabelEn,
                  linkUrl: slot.linkUrl,
                  mediaUrl: slot.mediaUrl,
                  sortOrder: slot.sortOrder,
                  startsAt: dateInput(slot.startsAt),
                  endsAt: dateInput(slot.endsAt),
                }

                return (
                  <Panel key={slot.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 font-medium">
                          <UserText>{slot.titleAr ?? slot.key}</UserText>
                          <Badge variant="neutral">
                            <span className="ltr-island">{slot.key}</span>
                          </Badge>
                          <Badge variant={slot.isActive && scheduled ? 'success' : 'neutral'}>
                            {slot.isActive
                              ? scheduled
                                ? t('dash.slotActive')
                                : t('dash.slotWindow')
                              : t('dash.slotInactive')}
                          </Badge>
                        </h3>
                        {slot.subtitleAr ? (
                          <UserText className="mt-0.5 block text-xs text-muted-foreground">
                            {slot.subtitleAr}
                          </UserText>
                        ) : null}
                        {slot.startsAt || slot.endsAt ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="numeric">
                              {slot.startsAt ? formatDate(slot.startsAt) : '—'}
                            </span>
                            {' — '}
                            <span className="numeric">
                              {slot.endsAt ? formatDate(slot.endsAt) : '—'}
                            </span>
                          </p>
                        ) : null}
                      </div>

                      <ActionButton
                        action={toggleSlotActive.bind(null, slot.id, !slot.isActive)}
                        label={slot.isActive ? t('dash.slotInactive') : t('dash.slotActive')}
                      />
                    </div>

                    <SlotEditor slot={value} />
                  </Panel>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t('dash.collections')}
          </h2>
          {collections.length === 0 ? (
            <EmptyState title={t('state.empty')} description={t('dash.merchandisingHint')} />
          ) : (
            <div className="space-y-2">
              {collections.map((collection) => (
                <Panel key={collection.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex flex-wrap items-center gap-2 font-medium">
                        <Link
                          href={`/collections/${collection.slug}`}
                          className="truncate transition-colors hover:text-gold"
                        >
                          <UserText>{collection.titleAr}</UserText>
                        </Link>
                        <Badge variant={collection.isPublished ? 'success' : 'neutral'}>
                          {collection.isPublished
                            ? t('dash.collectionPublished')
                            : t('dash.collectionDraft')}
                        </Badge>
                        {collection.isFeatured ? (
                          <Badge variant="gold">{t('dash.collectionFeatured')}</Badge>
                        ) : null}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="numeric">{formatNumber(collection._count.albums)}</span>{' '}
                        {t('commerce.album')}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <ActionButton
                        action={toggleCollection.bind(
                          null,
                          collection.id,
                          'isPublished',
                          !collection.isPublished,
                        )}
                        label={t('dash.publishToggle')}
                      />
                      <ActionButton
                        action={toggleCollection.bind(
                          null,
                          collection.id,
                          'isFeatured',
                          !collection.isFeatured,
                        )}
                        label={t('dash.featureToggle')}
                      />
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
