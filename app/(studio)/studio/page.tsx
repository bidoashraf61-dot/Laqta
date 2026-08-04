import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TrendingUp, Wallet } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { getEarnings, getDemandSignals } from '@/lib/studio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { formatMoney, formatNumber, t } from '@/lib/i18n'

export const metadata = { title: t('studio.title') }

const STATUS_LABEL: Record<string, string> = {
  draft: 'studio.draft',
  in_review: 'studio.inReview',
  changes_requested: 'studio.changesRequested',
  live: 'studio.live',
  paused: 'studio.paused',
  delisted: 'studio.delisted',
}

export default async function StudioPage() {
  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const [albums, earnings, demand] = await Promise.all([
    db.album.findMany({
      where: { creatorId: user.creatorId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        titleAr: true,
        titleEn: true,
        status: true,
        clipCount: true,
        priceStandard: true,
        currency: true,
      },
    }),
    getEarnings(user.creatorId),
    getDemandSignals(6),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-headline font-semibold">{t('studio.title')}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('studio.available')} value={formatMoney(earnings.available)} accent />
        <Stat label={t('studio.held')} value={formatMoney(earnings.held)} />
        <Stat label={t('studio.lifetime')} value={formatMoney(earnings.lifetime)} />
      </div>
      <p className="text-sm text-muted-foreground">{t('studio.holdExplain')}</p>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('studio.albums')}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/studio/earnings">
              <Wallet />
              {t('studio.earnings')}
            </Link>
          </Button>
        </div>

        {albums.length === 0 ? (
          <EmptyState title={t('studio.noAlbums')} />
        ) : (
          <div className="grid gap-3">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/studio/albums/${album.id}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/25"
              >
                <span className="min-w-0 flex-1 font-medium">
                  <Bilingual ar={album.titleAr} en={album.titleEn} />
                </span>
                <span className="numeric text-sm text-muted-foreground">
                  {album.clipCount} {t('studio.clips')}
                </span>
                <span className="numeric text-sm text-gold">
                  {formatMoney(Number(album.priceStandard), album.currency)}
                </span>
                <Badge variant={album.status === 'live' ? 'success' : 'neutral'}>
                  {t(STATUS_LABEL[album.status] ?? album.status)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* The most actionable thing the platform can tell a creator, and it
          costs nothing — search already logs it. */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-gold" />
              {t('studio.demand')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t('studio.demandHint')}</p>
          </CardHeader>
          <CardContent>
            {demand.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('state.empty')}</p>
            ) : (
              <ul className="space-y-2">
                {demand.map((signal) => (
                  <li key={signal.query} className="flex justify-between gap-4 text-sm">
                    <span>{signal.query}</span>
                    <span className="numeric text-muted-foreground">
                      {formatNumber(signal.searches)} {t('studio.searches')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`numeric mt-1 text-2xl font-bold ${accent ? 'text-gold' : ''}`}>{value}</p>
    </div>
  )
}
