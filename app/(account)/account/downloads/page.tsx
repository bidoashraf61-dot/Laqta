import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime, t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('library.downloadsTitle'),
  }
}

export default async function DownloadsPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const user = await requireUser()
  const downloads = await db.download.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      entitlement: { select: { album: { select: { titleAr: true } } } },
      clip: { select: { titleAr: true } },
    },
  })

  return (
    <div className="space-y-6">
      <PageTitle>{t('library.downloadsTitle')}</PageTitle>
      {downloads.length === 0 ? (
        <EmptyState title={t('library.noDownloads')} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('commerce.album')}</TableHead>
                <TableHead>{t('commerce.clip')}</TableHead>
                <TableHead>{t('library.purchasedOn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {downloads.map((download) => (
                <TableRow key={download.id}>
                  <TableCell>{download.entitlement.album.titleAr}</TableCell>
                  <TableCell>
                    {download.isAlbumZip
                      ? t('library.downloadAll')
                      : (download.clip?.titleAr ?? '—')}
                  </TableCell>
                  <TableCell className="numeric">{formatDateTime(download.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
