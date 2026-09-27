import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { OFFER_SELECT, priceNow } from '@/lib/offers'
import { ClipCard } from '@/components/catalogue/clip-card'
import { EmptyState } from '@/components/ui/state'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { BackLink } from '@/components/dashboard/primitives'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { CopyLink } from '@/components/account/copy-link'
import { PageTitle } from '@/components/ui/typography'
import { countOf, t } from '@/lib/i18n'
import { currentLocale, localePath } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'
import type { ClipHit } from '@/lib/search'
import { deleteBoard, removeClipFromBoard, renameBoard, setBoardPublic } from '../actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('boards.title'), robots: { index: false, follow: false } }
}

/**
 * One of the buyer's boards (DEV-49): its clips, each removable; share by
 * link on/off with the link to copy; rename; delete. The public view of the
 * same board is `/boards/[token]`, reachable only while it is shared.
 */
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  await requestLocale()
  const user = await requireUser()
  const { id } = await params

  const board = await db.board.findFirst({
    where: { id, userId: user.id },
    include: {
      clips: {
        orderBy: { addedAt: 'desc' },
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
              previewKey: true,
              album: {
                select: {
                  slug: true,
                  status: true,
                  titleAr: true,
                  titleEn: true,
                  ...OFFER_SELECT,
                  currency: true,
                  clipCount: true,
                  origin: true,
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

  // A clip whose album was paused or delisted stays on the board but is not
  // shown — the same rule as the public view.
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
      previewKey: clip.previewKey,
      album: {
        slug: clip.album.slug,
        titleAr: clip.album.titleAr,
        titleEn: clip.album.titleEn,
        priceStandard: priceNow(clip.album).priceStandard,
        currency: clip.album.currency,
        clipCount: clip.album.clipCount,
        origin: clip.album.origin,
        creatorHandle: clip.album.creator.handle,
        creatorNameAr: clip.album.creator.displayNameAr,
      },
    }))

  const sharePath = localePath(currentLocale(), `/boards/${board.shareToken}`)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <BackLink href="/account/boards" label={t('boards.title')} />
        <PageTitle>{board.name}</PageTitle>
        <p className="text-sm text-muted-foreground">{countOf('clip', hits.length)}</p>
      </div>

      <section aria-labelledby="share-heading" className="space-y-3 rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="share-heading" className="font-bold">
            {t('boards.makePublic')}
          </h2>
          <Badge variant={board.isPublic ? 'success' : 'neutral'}>
            {board.isPublic ? t('boards.isPublic') : t('boards.isPrivate')}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t('boards.shareHint')}</p>
        <div className="flex flex-wrap gap-2">
          {board.isPublic ? (
            <>
              <CopyLink path={sharePath} />
              <ActionButton action={setBoardPublic.bind(null, board.id, false)} label={t('boards.stopSharing')} variant="ghost" />
            </>
          ) : (
            <ActionButton action={setBoardPublic.bind(null, board.id, true)} label={t('boards.startSharing')} />
          )}
        </div>
      </section>

      {hits.length === 0 ? (
        <EmptyState title={t('boards.emptyBoard')} description={t('boards.emptyBoardHint')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hits.map((clip, i) => (
            <li key={clip.id} className="space-y-2">
              <ClipCard clip={clip} index={i} />
              <ActionButton
                action={removeClipFromBoard.bind(null, board.id, clip.id)}
                label={t('boards.remove')}
                variant="ghost"
              />
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="manage-heading" className="grid max-w-md gap-6">
        <h2 id="manage-heading" className="sr-only">
          {t('boards.manage')}
        </h2>
        <SettingsForm action={renameBoard.bind(null, board.id)} submitLabel={t('boards.rename')}>
          <Field label={t('boards.name')} htmlFor="rename-board" required>
            <Input id="rename-board" name="name" defaultValue={board.name} maxLength={80} required />
          </Field>
        </SettingsForm>
        <div>
          <ActionButton
            action={deleteBoard.bind(null, board.id)}
            label={t('boards.delete')}
            confirm={t('boards.deleteConfirm', { board: board.name })}
            variant="destructive"
          />
        </div>
      </section>
    </div>
  )
}
