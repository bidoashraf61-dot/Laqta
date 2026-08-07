import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { EmptyState } from '@/components/ui/state'
import { Headline } from '@/components/ui/typography'
import { Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'

/**
 * The Collection — the albums, as the considered pitch.
 *
 * Framed as "المجموعة الأولى" (the first collection) rather than a library:
 * with a young catalogue, owning the smallness reads as curation, not
 * shortage. Each album is a full poster card carrying its own price, so the
 * "buy the album, not the clip" model is legible at a glance.
 *
 * A single customer voice sits under the shelf, right where the buyer is
 * weighing the albums — the placement the conversion research points to.
 */
export function TheCollection({ albums }: { albums: AlbumCardData[] }) {
  return (
    <Section tone="raised">
      <div className="mb-10 max-w-2xl">
        <Headline lead={t('landing.collectionLead')} bold={t('landing.collectionBold')} size="lg" />
      </div>

      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard key={album.slug} album={album} />
          ))}
        </div>
      )}

      <Testimonial />
    </Section>
  )
}

/**
 * One customer voice, set as an editorial pull-quote rather than a card.
 *
 * NOTE FOR THE OWNER: the quote and attribution below are placeholders. Swap
 * `landing.testimonialQuote` / `testimonialName` / `testimonialRole` in
 * messages/ar.json for a real, attributable customer quote before launch — a
 * fabricated testimonial is both a trust and a legal risk. Until then this
 * renders as an obvious placeholder, not a fake claim.
 */
function Testimonial() {
  return (
    <figure className="mx-auto mt-16 max-w-3xl text-center">
      <blockquote className="font-display text-2xl font-light leading-[1.5] text-foreground/90">
        {t('landing.testimonialQuote')}
      </blockquote>
      <figcaption className="mt-6 text-sm text-muted-foreground">
        <span className="font-bold text-foreground">{t('landing.testimonialName')}</span>
        {' · '}
        {t('landing.testimonialRole')}
      </figcaption>
    </figure>
  )
}
