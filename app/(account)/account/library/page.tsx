import Link from 'next/link'
import { Infinity as InfinityIcon } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { getLibrary } from '@/lib/orders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { formatDate, t } from '@/lib/i18n'

export const metadata = { title: t('library.title') }

/**
 * The library — the post-purchase home, and where the ownership promise is
 * kept or broken. Every clip listed comes from the frozen manifest.
 */
export default async function LibraryPage() {
  const user = await requireUser()
  const library = await getLibrary(user.id)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-headline font-semibold">{t('library.title')}</h1>
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
                    <Badge variant={entry.licenceTier === 'extended' ? 'gold' : 'neutral'}>
                      {entry.licenceTier === 'extended'
                        ? t('commerce.licenceExtended')
                        : t('commerce.licenceStandard')}
                    </Badge>
                    {entry.paid ? null : (
                      <Badge variant="warning">{t('library.awaitingPayment')}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('commerce.byCreator', { creator: entry.album.creator.displayNameAr })} ·{' '}
                  <span className="numeric">{entry.clips.length}</span> {t('library.clips')} ·{' '}
                  {t('library.purchasedOn')} <span className="numeric">{formatDate(entry.grantedAt)}</span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" disabled={!entry.paid}>
                  <Link href={`/account/library/${entry.id}`}>{t('library.downloadAll')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/albums/${entry.album.creator.handle}/${entry.album.slug}`}>
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
