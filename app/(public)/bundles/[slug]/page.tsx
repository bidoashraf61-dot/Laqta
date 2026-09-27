import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Bilingual } from '@/components/ui/bilingual'
import { Anchor } from '@/components/ui/link'
import { buttonVariants } from '@/components/ui/button'
import { PageTitle, Prose } from '@/components/ui/typography'
import { BUNDLE_ALBUM_SELECT, bundleLines, overCeiling, priceBundle } from '@/lib/bundles'
import { priceNow } from '@/lib/offers'
import { clipCount, formatDate, formatMoney, t } from '@/lib/i18n'
import { localeAlternates, pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'
import { cn } from '@/lib/utils'

/**
 * `/bundles/[slug]` — one bundle: its albums, what they cost apart, what they
 * cost together, and «اشترِ الحزمة» (DEV-62).
 *
 * The price shown is computed exactly as checkout computes it — the albums'
 * prices now (offers included) through `priceBundle`, and the same
 * Laqta-share ceiling — so the page never promises a price the cart will not
 * give. A bundle that is not active or has not started is a 404; one that has
 * ended, or whose albums are no longer all on sale, still shows its albums but
 * no price and no button.
 */

async function getBundle(slug: string) {
  return db.bundle.findUnique({
    where: { slug },
    include: {
      albums: {
        orderBy: { position: 'asc' },
        include: {
          album: {
            select: {
              ...BUNDLE_ALBUM_SELECT,
              slug: true,
              status: true,
              titleAr: true,
              titleEn: true,
              currency: true,
              clipCount: true,
              totalRuntimeS: true,
              origin: true,
              orientation: true,
              coverClipId: true,
              creator: {
                select: { handle: true, displayNameAr: true, displayNameEn: true, tier: true, commissionRateOverride: true },
              },
            },
          },
        },
      },
    },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  const { slug } = await params
  const bundle = await getBundle(slug)
  if (!bundle || !bundle.isActive) return { title: t('state.notFound') }
  return {
    title: pickLocalised(bundle.titleAr, bundle.titleEn),
    description: pickLocalised(bundle.descriptionAr, bundle.descriptionEn) ?? t('bundle.buyHint'),
    alternates: localeAlternates(`/bundles/${slug}`),
  }
}

export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const { slug } = await params
  const bundle = await getBundle(slug)
  const now = new Date()
  if (!bundle || !bundle.isActive || (bundle.startsAt && bundle.startsAt > now)) notFound()

  const albums = bundle.albums.map((row) => row.album)
  const ended = bundle.endsAt !== null && bundle.endsAt <= now
  const allLive = albums.every((album) => album.status === 'live' && Number(album.priceStandard) > 0)
  const lines = allLive ? bundleLines(albums, now) : []
  const priced = allLive ? priceBundle(bundle.pricing, Number(bundle.value), lines) : null
  const withinCeiling = priced ? overCeiling(lines, priced.discounts).length === 0 : false
  const buyable = !ended && priced !== null && withinCeiling
  const currency = albums[0]?.currency ?? 'USD'

  const session = await auth()
  const owned = session?.user
    ? await db.entitlement.count({
        where: { userId: session.user.id, albumId: { in: albums.map((a) => a.id) }, revokedAt: null },
      })
    : 0

  const coverIds = albums.map((album) => album.coverClipId).filter(Boolean) as string[]
  const covers = coverIds.length
    ? await db.clip.findMany({ where: { id: { in: coverIds } }, select: { id: true, thumbnailKeys: true } })
    : []
  const coverById = new Map(covers.map((clip) => [clip.id, clip.thumbnailKeys[0] ?? null]))
  const cards: AlbumCardData[] = albums
    .filter((album) => album.status === 'live')
    .map((album) => ({
      slug: album.slug,
      creatorHandle: album.creator.handle,
      creatorNameAr: album.creator.displayNameAr,
      creatorNameEn: album.creator.displayNameEn,
      titleAr: album.titleAr,
      titleEn: album.titleEn,
      ...priceNow(album, now),
      currency: album.currency,
      clipCount: album.clipCount,
      totalRuntimeS: album.totalRuntimeS,
      origin: album.origin,
      orientation: album.orientation,
      coverKey: album.coverClipId ? (coverById.get(album.coverClipId) ?? null) : null,
    }))
  const totalClips = albums.reduce((sum, album) => sum + album.clipCount, 0)
  const description = pickLocalised(bundle.descriptionAr, bundle.descriptionEn)

  return (
    <div className="container py-10 lg:py-14">
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end">
        <div className="max-w-[62ch] space-y-4">
          <PageTitle>
            <Bilingual ar={bundle.titleAr} en={bundle.titleEn} />
          </PageTitle>
          {description ? <Prose>{description}</Prose> : null}
          <p className="text-sm text-muted-foreground">
            {t('bundle.albums', { count: albums.length })} · {clipCount(totalClips)}
          </p>
        </div>

        {/* The price block: apart, together, the saving — then the one action. */}
        <section aria-labelledby="bundle-price" className="rounded-lg border bg-card p-5">
          <h2 id="bundle-price" className="sr-only">
            {t('bundle.price')}
          </h2>
          {buyable && priced ? (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{t('bundle.regular')}</dt>
                  <dd className="numeric text-muted-foreground line-through">{formatMoney(priced.regular, currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="font-medium">{t('bundle.price')}</dt>
                  <dd className="numeric text-2xl font-bold text-gold">{formatMoney(priced.price, currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{t('bundle.save')}</dt>
                  <dd className="numeric font-medium text-success">{formatMoney(priced.discount, currency)}</dd>
                </div>
              </dl>
              <Anchor
                href={`/cart/add?bundle=${encodeURIComponent(bundle.slug)}`}
                className={cn(buttonVariants({ variant: 'gold', size: 'lg' }), 'mt-5 w-full')}
              >
                {t('bundle.buy')}
              </Anchor>
              <p className="mt-3 text-xs text-muted-foreground">{t('bundle.buyHint')}</p>
              {bundle.endsAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('bundle.ends')} <span className="numeric">{formatDate(bundle.endsAt)}</span>
                </p>
              ) : null}
              {owned > 0 ? (
                <p className="mt-3 border-t pt-3 text-xs text-warning">{t('bundle.ownedSome', { count: owned })}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{ended ? t('bundle.ended') : t('bundle.unavailable')}</p>
          )}
        </section>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((album, i) => (
          <AlbumCard key={album.slug} album={album} index={i} />
        ))}
      </div>
    </div>
  )
}
