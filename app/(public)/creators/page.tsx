import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates } from '@/lib/locale'
import { pickLocalised } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('catalogue.creatorsTitle'),
    alternates: localeAlternates('/creators'),
  }
}

export default async function CreatorsPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const creators = await db.creator.findMany({
    where: { status: 'approved', albums: { some: { status: 'live' } } },
    orderBy: [{ lifetimeGmv: 'desc' }, { createdAt: 'asc' }],
    select: {
      handle: true,
      displayNameAr: true,
      displayNameEn: true,
      bioAr: true,
      bioEn: true,
      cityAr: true,
      cityEn: true,
      _count: { select: { albums: true } },
    },
  })

  return (
    <div className="container-tight py-16">
      <PageTitle className="mb-6">{t('catalogue.creatorsTitle')}</PageTitle>

      {creators.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator) => (
            <Link
              key={creator.handle}
              href={`/creators/${creator.handle}`}
              className="rounded-lg border bg-card p-5 transition-colors hover:border-foreground/25"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-lg font-bold">
                  {pickLocalised(creator.displayNameAr, creator.displayNameEn).charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    <Bilingual ar={creator.displayNameAr} en={creator.displayNameEn} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pickLocalised(creator.cityAr, creator.cityEn)
                      ? `${pickLocalised(creator.cityAr, creator.cityEn)} · `
                      : ''}
                    <span className="numeric">{creator._count.albums}</span> {t('commerce.album')}
                  </p>
                </div>
              </div>
              {pickLocalised(creator.bioAr, creator.bioEn) ? (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {pickLocalised(creator.bioAr, creator.bioEn)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
