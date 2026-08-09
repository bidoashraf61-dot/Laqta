import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pause, Play, Plus } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Bilingual } from '@/components/ui/bilingual'
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
import { setAlbumVisibility } from '@/app/(studio)/studio/actions'
import { formatDate, formatMoney, formatNumber, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('studio.albums'),
  }
}

/**
 * Album manager.
 *
 * The creator's working list: every album, its state, what it earns, and the
 * one control that does not need a review round trip — pause and resume. The
 * filters live in the URL rather than in component state so a filtered view is
 * a link, and the list itself stays a server component.
 */
export default async function StudioAlbumsPage({
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

  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const creatorId = user.creatorId
  const { q, status } = await searchParams

  const where: Prisma.AlbumWhereInput = {
    creatorId,
    ...(status && statusValues('album').includes(status)
      ? { status: status as Prisma.EnumAlbumStatusFilter['equals'] }
      : {}),
    ...(q
      ? {
          OR: [
            { titleAr: { contains: q, mode: 'insensitive' } },
            { titleEn: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [albums, counts, rollup] = await Promise.all([
    db.album.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        titleAr: true,
        titleEn: true,
        status: true,
        clipCount: true,
        priceStandard: true,
        currency: true,
        updatedAt: true,
      },
    }),
    db.album.groupBy({ by: ['status'], where: { creatorId }, _count: { status: true } }),
    db.albumStat.groupBy({
      by: ['albumId'],
      where: { creatorId },
      _sum: { views: true, purchases: true },
    }),
  ])

  const byStatus = new Map(counts.map((row) => [row.status, row._count.status]))
  const statsById = new Map(rollup.map((row) => [row.albumId, row._sum]))

  return (
    <>
      <DashboardHeader
        title={t('dash.albumsManager')}
        description={t('dash.albumsManagerHint')}
        action={
          <Button asChild variant="gold" size="sm">
            <Link href="/studio/albums/new">
              <Plus />
              {t('studio.newAlbum')}
            </Link>
          </Button>
        }
      />

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
        <EmptyState
          title={t('studio.noAlbums')}
          description={t('dash.albumsManagerHint')}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/albums/new">{t('studio.newAlbum')}</Link>
            </Button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dash.colAlbum')}</TableHead>
                <TableHead>{t('dash.colStatus')}</TableHead>
                <TableHead className="text-end">{t('dash.colClips')}</TableHead>
                <TableHead className="text-end">{t('dash.colViews')}</TableHead>
                <TableHead className="text-end">{t('dash.colSales')}</TableHead>
                <TableHead className="text-end">{t('dash.colPrice')}</TableHead>
                <TableHead className="text-end">{t('dash.colUpdated')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {albums.map((album) => {
                const stat = statsById.get(album.id)
                return (
                  <TableRow key={album.id}>
                    <TableCell className="max-w-[18rem] font-medium">
                      <Link
                        href={`/studio/albums/${album.id}`}
                        className="block truncate transition-colors hover:text-gold"
                      >
                        <Bilingual ar={album.titleAr} en={album.titleEn} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge domain="album" value={album.status} />
                    </TableCell>
                    <TableCell className="numeric text-end text-muted-foreground">
                      {formatNumber(album.clipCount)}
                    </TableCell>
                    <TableCell className="numeric text-end text-muted-foreground">
                      {formatNumber(Number(stat?.views ?? 0))}
                    </TableCell>
                    <TableCell className="numeric text-end text-muted-foreground">
                      {formatNumber(Number(stat?.purchases ?? 0))}
                    </TableCell>
                    <TableCell className="numeric text-end text-gold">
                      {formatMoney(Number(album.priceStandard), album.currency)}
                    </TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground">
                      <span className="numeric">{formatDate(album.updatedAt)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      {album.status === 'live' ? (
                        <ActionButton
                          action={setAlbumVisibility.bind(null, album.id, 'paused')}
                          label={t('studio.paused')}
                          icon={<Pause className="size-3.5" />}
                        />
                      ) : album.status === 'paused' ? (
                        <ActionButton
                          action={setAlbumVisibility.bind(null, album.id, 'live')}
                          label={t('dash.resumeAlbum')}
                          icon={<Play className="size-3.5" />}
                        />
                      ) : (
                        <Link
                          href={`/studio/albums/${album.id}`}
                          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {t('dash.openAlbum')}
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Panel>
      )}
    </>
  )
}
