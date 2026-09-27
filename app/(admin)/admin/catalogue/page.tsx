import { Link } from '@/components/ui/link'
import { Pause, Play, Star, Trash2 } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Bilingual, UserText } from '@/components/ui/bilingual'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { FilterChips, SearchBox, Toolbar } from '@/components/dashboard/toolbar'
import { StatusBadge, statusLabel, statusValues } from '@/components/dashboard/status'
import { ActionButton } from '@/components/dashboard/form'
import { TrailerEditor } from '@/components/admin/trailer-editor'
import { setAlbumStatus, toggleAlbumFeatured } from '@/app/(admin)/admin/actions'
import { formatMoney, formatNumber, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { BandEditor, type EditableBand } from '@/components/admin/band-editor'
import { PricingSettings } from '@/components/admin/pricing-settings'
import { loadPricingChoices } from '@/lib/pricing-config'
import { ALBUM_TIERS, bandFit } from '@/lib/price-bands'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('admin.catalogue'),
  }
}

/**
 * The catalogue.
 *
 * Everything that has been through review, with the two escalations that skip
 * the queue: pause (reversible, for a complaint being looked at) and delist
 * (final, for content that must not come back). Buyers' entitlements are
 * served from their order snapshot, so neither one can break a completed
 * purchase — which is exactly why pausing is safe to do quickly.
 */
export default async function AdminCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
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
  const { q, status } = await searchParams

  const where: Prisma.AlbumWhereInput = {
    // The free sample's house album is curated on /admin/merchandising/sample,
    // never paused or delisted from here.
    sample: { is: null },
    ...(status && statusValues('album').includes(status)
      ? { status: status as Prisma.EnumAlbumStatusFilter['equals'] }
      : { status: { in: ['live', 'paused', 'delisted'] } }),
    ...(q
      ? {
          OR: [
            { titleAr: { contains: q, mode: 'insensitive' } },
            { titleEn: { contains: q, mode: 'insensitive' } },
            { creator: { displayNameAr: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const pricingChoices = await loadPricingChoices()
  const [albums, counts, bands] = await Promise.all([
    db.album.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        slug: true,
        titleAr: true,
        titleEn: true,
        status: true,
        clipCount: true,
        priceStandard: true,
        currency: true,
        isFeatured: true,
        salesCount: true,
        clearedForCommercial: true,
        trailerKey: true,
        creator: { select: { handle: true, displayNameAr: true, displayNameEn: true } },
      },
    }),
    db.album.groupBy({ by: ['status'], where: { sample: { is: null } }, _count: { status: true } }),
    db.priceBand.findMany({ orderBy: { priceStandard: 'asc' } }),
  ])

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))

  // Albums per tier — context for an edit, not a promise that they move: an
  // album's price was copied from its band when it was created.
  const tierCounts = await db.album.groupBy({
    by: ['tier'],
    where: { sample: { is: null }, status: { not: 'delisted' } },
    _count: { tier: true },
  })
  const albumsByTier = new Map(tierCounts.map((row) => [row.tier, row._count.tier]))
  const bandRows: EditableBand[] = bands.map((band) => ({
    id: band.id,
    tier: band.tier,
    labelAr: band.labelAr,
    labelEn: band.labelEn,
    minClips: band.minClips,
    maxClips: band.maxClips,
    price: Number(band.priceStandard),
    currency: band.currency,
    fit: bandFit(band),
    albumCount: albumsByTier.get(band.tier) ?? 0,
  }))
  const freeTiers = ALBUM_TIERS.filter((tier) => !bands.some((band) => band.tier === tier))

  // Watermarked-preview downloads over the last 30 days — someone cutting the
  // album into their own timeline before buying. A ZIP counts once.
  const comps = albums.length
    ? await db.compDownload.groupBy({
        by: ['albumId'],
        where: {
          albumId: { in: albums.map((album) => album.id) },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        _count: { _all: true },
      })
    : []
  const compsByAlbum = new Map(comps.map((row) => [row.albumId, row._count._all]))

  return (
    <>
      <DashboardHeader title={t('dash.catalogueTitle')} description={t('dash.catalogueHint')} />

      <div className="space-y-6">
        <div>
          <Toolbar>
            <SearchBox placeholder={t('dash.searchAlbums')} />
            <FilterChips
              options={statusValues('album').map((value) => ({
                value,
                label: statusLabel('album', value),
                count: byStatus.get(value as never) ?? 0,
              }))}
            />
          </Toolbar>

          {albums.length === 0 ? (
            <EmptyState title={t('state.empty')} description={t('dash.catalogueHint')} />
          ) : (
            <Panel className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dash.colAlbum')}</TableHead>
                    <TableHead>{t('dash.colCreator')}</TableHead>
                    <TableHead>{t('dash.colStatus')}</TableHead>
                    <TableHead className="text-end">{t('dash.colClips')}</TableHead>
                    <TableHead className="text-end">{t('dash.colSales')}</TableHead>
                    <TableHead className="text-end" title={t('dash.colCompsHint')}>
                      {t('dash.colComps')}
                    </TableHead>
                    <TableHead className="text-end">{t('dash.colPrice')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {albums.map((album) => (
                    <TableRow key={album.id}>
                      <TableCell className="max-w-[16rem] font-medium">
                        <Link
                          href={`/albums/${album.creator.handle}/${album.slug}`}
                          className="block truncate transition-colors hover:text-gold"
                        >
                          <Bilingual ar={album.titleAr} en={album.titleEn} />
                        </Link>
                        {album.clearedForCommercial ? (
                          <span className="mt-0.5 block text-2xs text-success">
                            {t('commerce.clearedForCommercial')}
                          </span>
                        ) : null}
                        {/* Stated in words, not by an icon's colour: the
                            album page leads with this cut when it is set. */}
                        <span className="mt-0.5 block text-2xs text-muted-foreground">
                          {album.trailerKey ? t('dash.trailerSet') : t('dash.trailerNone')}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-muted-foreground">
                        <UserText>{album.creator.displayNameAr}</UserText>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge domain="album" value={album.status} />
                          {album.isFeatured ? (
                            <Star
                              className="size-3.5 fill-gold text-gold"
                              aria-label={t('dash.featureToggle')}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="numeric text-end text-muted-foreground">
                        {formatNumber(album.clipCount)}
                      </TableCell>
                      <TableCell className="numeric text-end text-muted-foreground">
                        {formatNumber(album.salesCount)}
                      </TableCell>
                      <TableCell className="numeric text-end text-muted-foreground">
                        {formatNumber(compsByAlbum.get(album.id) ?? 0)}
                      </TableCell>
                      <TableCell className="numeric text-end text-gold">
                        {formatMoney(Number(album.priceStandard), album.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <TrailerEditor
                            albumId={album.id}
                            albumSlug={album.slug}
                            trailerKey={album.trailerKey}
                          />
                          {album.status === 'live' ? (
                            <ActionButton
                              action={setAlbumStatus.bind(null, album.id, 'paused')}
                              label={t('dash.pauseAlbum')}
                              icon={<Pause className="size-3.5" />}
                            />
                          ) : album.status === 'paused' ? (
                            <ActionButton
                              action={setAlbumStatus.bind(null, album.id, 'live')}
                              label={t('dash.resumeAlbum')}
                              icon={<Play className="size-3.5" />}
                            />
                          ) : null}

                          {album.status !== 'delisted' ? (
                            <>
                              <ActionButton
                                action={toggleAlbumFeatured.bind(null, album.id, !album.isFeatured)}
                                label={t('dash.featureToggle')}
                                icon={<Star className="size-3.5" />}
                              />
                              <ActionButton
                                action={setAlbumStatus.bind(null, album.id, 'delisted')}
                                label={t('dash.delistAlbum')}
                                variant="ghost"
                                confirm={t('dash.delistAlbum')}
                                icon={<Trash2 className="size-3.5" />}
                              />
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          )}
        </div>

        {/* The bands are the pricing policy in one place. Editing one changes
            the price new albums are created at — nothing else; the hint says
            so in words (lib/price-bands.ts). */}
        <Panel title={t('dash.priceBands')} className="overflow-hidden">
          <p className="mb-2 text-xs text-muted-foreground">{t('dash.priceBandsHint')}</p>
          {bandRows.some((band) => band.fit !== 'inside') ? (
            <p className="mb-4 text-xs text-warning">{t('dash.bandOutsideHint')}</p>
          ) : (
            <div className="mb-4" />
          )}
          <BandEditor bands={bandRows} freeTiers={freeTiers} />
        </Panel>

        {/* The rest of the price calculator (DEV-09c): range, spread and the
            multipliers. The bands above are its clip-count bases. */}
        <Panel title={t('dash.pricing.title')}>
          <PricingSettings
            choices={pricingChoices}
            bands={bands.map((band) => ({
              minClips: band.minClips,
              maxClips: band.maxClips,
              priceStandard: Number(band.priceStandard),
            }))}
          />
        </Panel>
      </div>
    </>
  )
}
