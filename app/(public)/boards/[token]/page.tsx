import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { ClipCard } from '@/components/catalogue/clip-card'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import type { ClipHit } from '@/lib/search'

/**
 * A shared board, viewable WITHOUT an account.
 *
 * That is the whole agency workflow: build a shortlist, send the link to the
 * client, the client picks, the agency buys. Requiring the client to sign up
 * to look at a shortlist kills it — so this route sits in (public) and is
 * gated only by the unguessable share token.
 *
 * Every clip still carries its album ribbon and price, because the client
 * looking at this is exactly the person deciding what to approve.
 */
export default async function SharedBoardPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const board = await db.board.findFirst({
    where: { shareToken: token, isPublic: true },
    include: {
      user: { select: { name: true } },
      clips: {
        include: {
          clip: {
            select: {
              id: true,
              slug: true,
              titleAr: true,
              titleEn: true,
              durationS: true,
              width: true,
              height: true,
              fps: true,
              aspectRatio: true,
              thumbnailKeys: true,
              previewHlsKey: true,
              album: {
                select: {
                  slug: true,
                  status: true,
                  titleAr: true,
                  titleEn: true,
                  priceStandard: true,
                  currency: true,
                  clipCount: true,
                  clearedForCommercial: true,
                  creator: { select: { handle: true, displayNameAr: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!board) notFound()

  const hits: ClipHit[] = board.clips
    .map((row) => row.clip)
    .filter((clip) => clip.album.status === 'live')
    .map((clip) => ({
      id: clip.id,
      slug: clip.slug,
      titleAr: clip.titleAr,
      titleEn: clip.titleEn,
      durationS: Number(clip.durationS),
      width: clip.width,
      height: clip.height,
      fps: Number(clip.fps),
      aspectRatio: clip.aspectRatio,
      thumbnail: clip.thumbnailKeys[0] ?? null,
      previewHlsKey: clip.previewHlsKey,
      album: {
        slug: clip.album.slug,
        titleAr: clip.album.titleAr,
        titleEn: clip.album.titleEn,
        priceStandard: Number(clip.album.priceStandard),
        currency: clip.album.currency,
        clipCount: clip.album.clipCount,
        clearedForCommercial: clip.album.clearedForCommercial,
        creatorHandle: clip.album.creator.handle,
        creatorNameAr: clip.album.creator.displayNameAr,
      },
    }))

  return (
    <div className="container py-10">
      <header className="mb-6 space-y-1">
        <h1 className="font-display text-headline font-bold">{board.name}</h1>
        <p className="numeric text-sm text-muted-foreground">
          {hits.length} {t('boards.clips')}
        </p>
      </header>

      {hits.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {hits.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      )}
    </div>
  )
}
