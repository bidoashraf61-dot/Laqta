import { Link } from '@/components/ui/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SettingsForm, ActionButton } from '@/components/dashboard/form'
import { countOf, t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'
import { PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'
import { addClipToBoard, createBoard } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('boards.title'),
  }
}

/**
 * The buyer's boards (DEV-49).
 *
 * `?add=<clipId>` is how the clip page's «أضف للوح» arrives: the page then
 * leads with "add this clip to…" — one button per board, or a new board that
 * starts with the clip — before the list. Without it, the list and a create
 * form.
 */
export default async function BoardsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
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
  const { add } = await searchParams
  const [boards, adding] = await Promise.all([
    db.board.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { clips: true } },
        ...(add ? { clips: { where: { clipId: add }, select: { clipId: true } } } : {}),
      },
    }),
    add
      ? db.clip.findFirst({
          where: { id: add, album: { status: 'live' } },
          select: { id: true, titleAr: true, titleEn: true, slug: true },
        })
      : null,
  ])

  return (
    <div className="space-y-8">
      <PageTitle>{t('boards.title')}</PageTitle>

      {adding ? (
        <section aria-labelledby="add-heading" className="space-y-4 rounded-lg border bg-card p-5">
          <h2 id="add-heading" className="font-bold">
            {t('boards.addTitle', { clip: pickLocalised(adding.titleAr, adding.titleEn) ?? '' })}
          </h2>
          {boards.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {boards.map((board) => {
                const already = 'clips' in board && Array.isArray(board.clips) && board.clips.length > 0
                return (
                  <li key={board.id}>
                    {already ? (
                      <Badge variant="success">{t('boards.alreadyOn', { board: board.name })}</Badge>
                    ) : (
                      <ActionButton action={addClipToBoard.bind(null, board.id, adding.id)} label={board.name} />
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
          <SettingsForm action={createBoard} submitLabel={t('boards.createWithClip')} className="max-w-md">
            <input type="hidden" name="addClipId" value={adding.id} />
            <Field label={t('boards.name')} htmlFor="new-board-name" required>
              <Input id="new-board-name" name="name" maxLength={80} required />
            </Field>
          </SettingsForm>
          <p className="text-sm">
            <Link href={`/footage/${adding.slug}`} className="text-muted-foreground underline-offset-4 hover:underline">
              {t('boards.backToClip')}
            </Link>
          </p>
        </section>
      ) : null}

      {boards.length === 0 && !adding ? (
        <EmptyState title={t('boards.empty')} description={t('boards.emptyHint')} />
      ) : boards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Card key={board.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/account/boards/${board.id}`} className="underline-offset-4 hover:underline">
                    {board.name}
                  </Link>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{countOf('clip', board._count.clips)}</p>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge variant={board.isPublic ? 'success' : 'neutral'}>
                  {board.isPublic ? t('boards.isPublic') : t('boards.isPrivate')}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!adding ? (
        <section aria-labelledby="create-heading" className="max-w-md space-y-3">
          <h2 id="create-heading" className="font-bold">
            {t('boards.create')}
          </h2>
          <SettingsForm action={createBoard} submitLabel={t('boards.create')}>
            <Field label={t('boards.name')} htmlFor="board-name" required>
              <Input id="board-name" name="name" maxLength={80} required />
            </Field>
          </SettingsForm>
        </section>
      ) : null}
    </div>
  )
}
