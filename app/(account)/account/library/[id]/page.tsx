import { Link } from '@/components/ui/link'
import { notFound } from 'next/navigation'
import { Download, FileText, Info } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { downloadUrl } from '@/lib/storage'
import { Alert, AlertDescription } from '@/components/ui/state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bilingual } from '@/components/ui/bilingual'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { requestLocale } from '@/lib/locale-request'

type ManifestClip = {
  id: string
  slug: string
  titleAr: string
  titleEn: string
  masterKey: string | null
  proxyKey: string | null
  /** Sample manifests only: the album the clip is sold in. */
  sourceAlbum?: { slug: string; titleAr: string; titleEn: string; creatorHandle: string }
}

/**
 * Album downloads.
 *
 * The clip list comes from `OrderItem.clipManifestSnapshot` and nowhere else.
 * If the creator has since deleted a clip from the album, it is still here and
 * still downloadable — that is the promise being kept, and it is the reason
 * this page never touches `album.clips`.
 */
export default async function LibraryAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const { id } = await params
  const user = await requireUser()

  const entitlement = await db.entitlement.findFirst({
    where: { id, userId: user.id, revokedAt: null },
    include: {
      album: { select: { titleAr: true, titleEn: true } },
      orderItem: {
        select: {
          id: true,
          clipManifestSnapshot: true,
          certificate: { select: { certificateNumber: true } },
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
        <Link
          href="/account/library"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t('library.title')}
        </Link>
        <PageTitle>
          <Bilingual ar={entitlement.album.titleAr} en={entitlement.album.titleEn} />
        </PageTitle>
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
        <div className="flex flex-wrap gap-3">
          {/* A plain anchor, not next/link. Every download target is a route
              handler that redirects to storage; the client router fetches an
              RSC payload for it, fails, and falls back to a browser navigation
              — a wasted round trip and a console error on the one page that
              hands over what someone paid for. */}
          <Button asChild variant="outline">
            <a
              href={downloadUrl({
                key: `albums/${entitlement.albumId}.zip`,
                entitlementId: entitlement.id,
                clipId: null,
              })}
            >
              <Download />
              {t('library.downloadAll')}
            </a>
          </Button>

          {/* The document a buyer submits when someone claims their footage.
              A plain anchor: it opens a PDF from a route handler, which the
              client router has no business trying to treat as a page. */}
          {entitlement.orderItem.certificate ? (
            <Button asChild variant="outline">
              <a
                href={`/account/certificates/${entitlement.orderItem.id}`}
                target="_blank"
                rel="noopener"
              >
                <FileText />
                {t('library.licencesTitle')}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <ul className="divide-y rounded-lg border">
        {clips.map((clip) => (
          <li key={clip.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate">
                <Bilingual ar={clip.titleAr} en={clip.titleEn} />
              </span>
              {/* A sample clip names the album it is sold in — sample → purchase. */}
              {clip.sourceAlbum ? (
                <Link
                  href={`/albums/${clip.sourceAlbum.creatorHandle}/${clip.sourceAlbum.slug}`}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-gold"
                >
                  <Bilingual ar={clip.sourceAlbum.titleAr} en={clip.sourceAlbum.titleEn} />
                </Link>
              ) : null}
            </span>

            {paid && clip.masterKey ? (
              <Button asChild variant="outline" size="sm">
                <a href={downloadUrl({
                    key: clip.masterKey,
                    entitlementId: entitlement.id,
                    clipId: clip.id,
                  })}>
                  <Download />
                  {t('library.downloadClip')}
                </a>
              </Button>
            ) : null}

            {/* Editing proxies alongside masters — editors cut with these and
                only pull the 4GB original once the edit is locked. */}
            {paid && clip.proxyKey ? (
              <Button asChild variant="ghost" size="sm">
                <a href={downloadUrl({
                    key: clip.proxyKey,
                    entitlementId: entitlement.id,
                    clipId: clip.id,
                  })}>
                  {t('library.downloadProxy')}
                </a>
              </Button>
            ) : null}

            {!clip.masterKey ? <Badge variant="neutral">—</Badge> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
