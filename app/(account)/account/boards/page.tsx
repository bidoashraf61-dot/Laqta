import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/lib/i18n'

export const metadata = { title: t('boards.title') }

export default async function BoardsPage() {
  const user = await requireUser()
  const boards = await db.board.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { clips: true } } },
  })

  return (
    <div className="space-y-6">
      <h1 className="font-display text-headline font-bold">{t('boards.title')}</h1>

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
