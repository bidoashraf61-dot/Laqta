import { albumHref } from '@/components/catalogue/album-card'
import { Headline, Prose, Section } from '@/components/ui/typography'
import type { LandingTrailer } from '@/lib/catalogue'
import { clipCount, formatMoney, t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'
import { TrailerTheatre, type TheatreItem } from '@/components/landing/trailer-theatre'

/**
 * Album trailers — the album seen moving before it is bought.
 *
 * Sits after the collection and before the licence. The collection shows each
 * album as a still poster; this is the same product in motion, so a buyer who
 * has picked a poster can watch what it holds before reading the terms. It is
 * deliberately NOT next to the footage wall: that section already opens with
 * the showreel, and two large players back to back compete for the same eye.
 *
 * Everything a buyer needs to act — title, clip count, price, the album link —
 * is formatted HERE, on the server, where `t()`/`formatMoney()` are correct.
 * The theatre below is a client component (it owns the player) and only has to
 * swap between strings it was handed.
 *
 * Hidden entirely when no live album has a trailer that resolves — the normal
 * state of a young catalogue. There is no empty theatre.
 */
export function Trailers({ trailers }: { trailers: LandingTrailer[] }) {
  if (trailers.length === 0) return null

  const items: TheatreItem[] = trailers.map((album) => {
    const title = pickLocalised(album.titleAr, album.titleEn)
    return {
      slug: album.slug,
      title,
      href: albumHref(album),
      trailerKey: album.trailerKey,
      posterKey: album.coverKey,
      clips: clipCount(album.clipCount),
      price: formatMoney(album.priceStandard, album.currency),
      videoLabel: t('media.trailerAlt', { album: title }),
    }
  })

  return (
    <Section tone="base" aria-labelledby="trailers-heading">
      <div className="mb-10 max-w-2xl">
        <div id="trailers-heading">
          <Headline lead={t('landing.trailersLead')} bold={t('landing.trailersBold')} size="lg" />
        </div>
        <Prose className="mt-5">{t('landing.trailersBody')}</Prose>
      </div>

      <TrailerTheatre items={items} />
    </Section>
  )
}
