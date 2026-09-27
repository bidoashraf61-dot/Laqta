import type { Metadata } from 'next'
import { ExternalLink, PencilLine, Plus } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Anchor } from '@/components/ui/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { ActionButton } from '@/components/dashboard/form'
import { setBundleActiveAction } from './actions'
import { BUNDLE_ALBUM_SELECT, bundleLines, overCeiling, priceBundle } from '@/lib/bundles'
import { formatDate, formatMoney, t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return { title: t('dash.bundles.title') }
}

type BundleState = 'running' | 'scheduled' | 'ended' | 'off' | 'unavailable'

/**
 * `/admin/bundles` — every bundle, with what it costs apart and together
 * today and whether a buyer can get it right now (DEV-62).
 *
 * «غير متاحة» is worth its own state: a running bundle whose album was paused,
 * or whose discount now exceeds Laqta's share because a price or rate changed,
 * silently stops applying at checkout — the owner has to see that here.
 */
export default async function AdminBundlesPage() {
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

  const bundles = await db.bundle.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    include: {
      albums: {
        orderBy: { position: 'asc' },
        include: { album: { select: { ...BUNDLE_ALBUM_SELECT, status: true, currency: true } } },
      },
    },
  })
  const now = new Date()

  const rows = bundles.map((bundle) => {
    const albums = bundle.albums.map((row) => row.album)
    const allLive = albums.every((album) => album.status === 'live' && Number(album.priceStandard) > 0)
    const lines = allLive ? bundleLines(albums, now) : []
    const priced = allLive ? priceBundle(bundle.pricing, Number(bundle.value), lines) : null
    const withinCeiling = priced ? overCeiling(lines, priced.discounts).length === 0 : false
    const state: BundleState = !bundle.isActive
      ? 'off'
      : bundle.endsAt && bundle.endsAt <= now
        ? 'ended'
        : bundle.startsAt && bundle.startsAt > now
          ? 'scheduled'
          : priced && withinCeiling
            ? 'running'
            : 'unavailable'
    return { bundle, albums, priced, state, currency: albums[0]?.currency ?? 'USD' }
  })

  const newButton = (
    <Anchor href="/admin/bundles/new" className={buttonVariants({ size: 'sm' })}>
      <Plus className="size-4" aria-hidden />
      {t('dash.bundles.new')}
    </Anchor>
  )

  return (
    <>
      <DashboardHeader title={t('dash.bundles.title')} description={t('dash.bundles.hint')} action={newButton} />

      {rows.length === 0 ? (
        <EmptyState title={t('dash.bundles.empty')} description={t('dash.bundles.emptyHint')} action={newButton} />
      ) : (
        <Panel>
          <ul className="-my-2 divide-y divide-border/60">
            {rows.map(({ bundle, albums, priced, state, currency }) => (
              <li key={bundle.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="flex flex-wrap items-center gap-2 font-medium">
                    <Anchor
                      href={`/admin/bundles/${bundle.id}`}
                      className="transition-colors duration-hover ease-lens hover:text-gold"
                    >
                      {pickLocalised(bundle.titleAr, bundle.titleEn)}
                    </Anchor>
                    <Badge variant={state === 'running' ? 'success' : state === 'unavailable' ? 'warning' : 'neutral'}>
                      {t(`dash.bundles.state.${state}`)}
                    </Badge>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('dash.bundles.albumCount', { count: albums.length })}
                    {' · '}
                    {bundle.pricing === 'percent_off' ? (
                      t('dash.bundles.percentOff', { value: Number(bundle.value) })
                    ) : (
                      t('dash.bundles.fixedPrice')
                    )}
                    {priced ? (
                      <>
                        {' · '}
                        <span className="numeric line-through">{formatMoney(priced.regular, currency)}</span>{' '}
                        <span className="numeric font-medium text-foreground">{formatMoney(priced.price, currency)}</span>
                      </>
                    ) : null}
                    {bundle.startsAt || bundle.endsAt ? (
                      <>
                        {' · '}
                        <span className="numeric">{bundle.startsAt ? formatDate(bundle.startsAt) : '—'}</span>
                        {' — '}
                        <span className="numeric">{bundle.endsAt ? formatDate(bundle.endsAt) : '—'}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Anchor
                    href={`/bundles/${bundle.slug}`}
                    target="_blank"
                    rel="noopener"
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    {t('dash.docs.view')}
                    <span className="sr-only">{t('dash.docs.viewNewTab')}</span>
                  </Anchor>
                  <ActionButton
                    action={setBundleActiveAction.bind(null, bundle.id, !bundle.isActive)}
                    label={bundle.isActive ? t('dash.bundles.deactivate') : t('dash.bundles.activate')}
                    confirm={bundle.isActive ? t('dash.bundles.deactivateConfirm') : undefined}
                  />
                  <Anchor href={`/admin/bundles/${bundle.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <PencilLine className="size-3.5" aria-hidden />
                    {t('dash.docs.edit')}
                  </Anchor>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}
