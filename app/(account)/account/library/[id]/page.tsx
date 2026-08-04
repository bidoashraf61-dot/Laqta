import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Download, Info } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { downloadUrl } from '@/lib/storage'
import { Alert, AlertDescription } from '@/components/ui/state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { t } from '@/lib/i18n'

type ManifestClip = {
  id: string
  slug: string
  titleAr: string
  titleEn: string
  masterKey: string | null
  proxyKey: string | null
}

/**
 * Album downloads.
 *
 * The clip list comes from `OrderItem.clipManifestSnapshot` and nowhere else.
 * If the creator has since deleted a clip from the album, it is still here and
 * still downloadable — that is the promise being kept, and it is the reason
 * this page never touches `album.clips`.
 */
export default async function LibraryAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const entitlement = await db.entitlement.findFirst({
    where: { id, userId: user.id, revokedAt: null },
    include: {
      album: { select: { titleAr: true, titleEn: true } },
      orderItem: {
        select: {
          clipManifestSnapshot: true,
          order: { select: { orderNumber: true, status: true } },
        },
      },
    },
  })
  if (!entitlement) notFound()

  const clips = (entitlement.orderItem.clipManifestSnapshot ?? []) as ManifestClip[]
  const paid = entitlement.orderItem.order.status === 'paid'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/account/library" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('library.title')}
        </Link>
        <h1 className="font-display text-headline font-semibold">
          <Bilingual ar={entitlement.album.titleAr} en={entitlement.album.titleEn} />
        </h1>
        <p className="numeric text-sm text-muted-foreground">
          {entitlement.orderItem.order.orderNumber}
        </p>
      </header>

      {!paid ? (
        <Alert variant="warning">
          <AlertDescription>{t('library.awaitingPayment')}</AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="info">
        <AlertDescription className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          {t('library.frozenNote')}
        </AlertDescription>
      </Alert>

      {paid ? (
        <Button asChild variant="outline">
          <Link
            href={downloadUrl({
              key: `albums/${entitlement.albumId}.zip`,
              entitlementId: entitlement.id,
              clipId: null,
            })}
          >
            <Download />
            {t('library.downloadAll')}
          </Link>
        </Button>
      ) : null}

      <ul className="divide-y rounded-lg border">
        {clips.map((clip) => (
          <li key={clip.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="min-w-0 flex-1 truncate text-sm">
              <Bilingual ar={clip.titleAr} en={clip.titleEn} />
            </span>

            {paid && clip.masterKey ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={downloadUrl({
                    key: clip.masterKey,
                    entitlementId: entitlement.id,
                    clipId: clip.id,
                  })}
                >
                  <Download />
                  {t('library.downloadClip')}
                </Link>
              </Button>
            ) : null}

            {/* Editing proxies alongside masters — editors cut with these and
                only pull the 4GB original once the edit is locked. */}
            {paid && clip.proxyKey ? (
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={downloadUrl({
                    key: clip.proxyKey,
                    entitlementId: entitlement.id,
                    clipId: clip.id,
                  })}
                >
                  {t('library.downloadProxy')}
                </Link>
              </Button>
            ) : null}

            {!clip.masterKey ? <Badge variant="neutral">—</Badge> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
