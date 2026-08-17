import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { db } from '@/lib/db'
import { Bilingual } from '@/components/ui/bilingual'
import { EmptyState } from '@/components/ui/state'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { CreatorCta } from '@/components/landing/sections'
import { Stars } from '@/components/ui/stars'
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

/**
 * A creator's rating: the weighted mean across their live albums.
 *
 * Weighted by review count, not a mean of the averages. An album with one
 * five-star review would otherwise pull a creator's score as hard as one with
 * ninety reviews averaging 4.6, which is how a new seller with a single
 * friendly buyer ends up outranking the catalogue's best.
 *
 * Returns null with no reviews at all. "0.0" and "no ratings yet" are
 * different facts, and drawing five empty stars for the second says the first.
 */
function creatorRating(albums: Array<{ ratingAvg: unknown; ratingCount: number }>) {
  let weighted = 0
  let total = 0
  for (const album of albums) {
    if (!album.ratingCount || album.ratingAvg == null) continue
    weighted += Number(album.ratingAvg) * album.ratingCount
    total += album.ratingCount
  }
  return total > 0 ? { value: weighted / total, count: total } : null
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
      // Ratings live on the album, so a creator's rating is an aggregate of
      // theirs. Pulled per creator rather than computed in SQL because the
      // weighting below is not an AVG (see `creatorRating`).
      albums: {
        where: { status: 'live' },
        select: { ratingAvg: true, ratingCount: true },
      },
    },
  })

  return (
    <>
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

      {/*
        The invitation to sell, closing the page.

        It used to close the LANDING page, where it addressed creators
        immediately after the previous eight sections had spent their effort
        persuading buyers — and competed with the final buyer CTA directly
        above it. Here it follows a screen full of other people's work, which
        is the moment someone is most likely to picture their own on it.
      */}
      <CreatorCta />
    </>
  )
}
