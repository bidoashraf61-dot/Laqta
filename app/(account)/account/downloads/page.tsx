import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, t } from '@/lib/i18n'

export const metadata = { title: t('library.downloadsTitle') }

export default async function DownloadsPage() {
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
      <h1 className="font-display text-headline font-semibold">{t('library.downloadsTitle')}</h1>
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
                    {download.isAlbumZip ? t('library.downloadAll') : (download.clip?.titleAr ?? '—')}
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
