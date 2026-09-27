import { Link } from '@/components/ui/link'
import { Infinity as InfinityIcon } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { getLibrary } from '@/lib/orders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { countOf, formatDate, t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('library.title'),
  }
}

/**
 * The library — the post-purchase home, and where the ownership promise is
 * kept or broken. Every clip listed comes from the frozen manifest.
 */
export default async function LibraryPage() {
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
  const library = await getLibrary(user.id)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <PageTitle>{t('library.title')}</PageTitle>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <InfinityIcon className="size-4 text-gold" />
          {t('library.ownedForever')}
        </p>
      </header>

      {library.length === 0 ? (
        <EmptyState
          title={t('library.empty')}
          description={t('library.emptyHint')}
          action={
            <Button asChild variant="gold">
              <Link href="/albums">{t('nav.albums')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {library.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>
                    <Bilingual ar={entry.album.titleAr} en={entry.album.titleEn} />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* One licence, so the badge no longer distinguishes a
                        tier — it confirms what was bought. */}
                    <Badge variant="neutral">{t('commerce.licenceCommercial')}</Badge>
                    {entry.paid ? null : (
                      <Badge variant="warning">{t('library.awaitingPayment')}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('commerce.byCreator', { creator: entry.album.creator.displayNameAr })} ·{' '}
                  {countOf('clip', entry.clips.length)} ·{' '}
                  {t('library.purchasedOn')}{' '}
                  <span className="numeric">{formatDate(entry.grantedAt)}</span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" disabled={!entry.paid}>
                  <Link href={`/account/library/${entry.id}`}>{t('library.downloadAll')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={
                      entry.isSample
                        ? '/sample'
                        : `/albums/${entry.album.creator.handle}/${entry.album.slug}`
                    }
                  >
                    {t('commerce.album')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
