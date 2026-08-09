import { Link } from '@/components/ui/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('boards.title'),
  }
}

export default async function BoardsPage() {
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
  const boards = await db.board.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { clips: true } } },
  })

  return (
    <div className="space-y-6">
      <PageTitle>{t('boards.title')}</PageTitle>

      {boards.length === 0 ? (
        <EmptyState title={t('boards.empty')} description={t('boards.emptyHint')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Card key={board.id}>
              <CardHeader>
                <CardTitle>{board.name}</CardTitle>
                <p className="numeric text-sm text-muted-foreground">
                  {board._count.clips} {t('boards.clips')}
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {board.isPublic ? (
                  <Link href={`/boards/${board.shareToken}`}>
                    <Badge variant="success">{t('boards.share')}</Badge>
                  </Link>
                ) : (
                  <Badge variant="neutral">{t('boards.makePublic')}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
