import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { EmptyState } from '@/components/ui/state'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'

/**
 * The seasonal shelf — what to buy for what is coming.
 *
 * ── What this replaced ──────────────────────────────────────────────────────
 * A second grid of featured albums. The footage wall sits directly above it and
 * the full catalogue is one click away, so the page's most valuable band was
 * spent showing the same albums a visitor had already scrolled past. It read as
 * a longer page rather than a better one.
 *
 * ── What it does instead ────────────────────────────────────────────────────
 * It answers the question a buyer arrives with, which is a date and not a
 * subject: National Day is in six weeks, Ramadan is being planned in Sha'ban,
 * Founding Day is worked through January. `lib/season.ts` decides which
 * occasion is live — the windows LEAD the date, because nobody commissions
 * Ramadan footage during Ramadan.
 *
 * When no occasion is in season, or the catalogue has nothing tagged for the
 * one that is, the shelf becomes the newest albums on offer and says so. It
 * never invents a season to fill the slot.
 */
export function TheCollection({
  albums,
  season,
}: {
  albums: AlbumCardData[]
  season: { slug: string; nameAr: string; nameEn: string } | null
}) {
  return (
    <Section tone="olive">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        {/* Sand, not gold: on this ground gold reaches 2.82:1. */}
        <Badge variant="sand" className="mb-3">
          {season ? t('landing.seasonEyebrow') : t('landing.offersEyebrow')}
        </Badge>

        {season ? (
          <Headline
            lead={t('landing.seasonLead')}
            /*
             * The occasion's own name, out of the taxonomy — so the shelf is
             * labelled with the exact term the catalogue filters on, rather
             * than a second hand-written string that can drift from it.
             *
             * `pickLocalised`, not `<Bilingual>`: `Headline` takes its lead and
             * bold lines as strings.
             */
            bold={pickLocalised(season.nameAr, season.nameEn)}
            size="lg"
          />
        ) : (
          <Headline lead={t('landing.offersLead')} bold={t('landing.offersBold')} size="lg" />
        )}

        <Prose className="mx-auto mt-5">
          {season ? t('landing.seasonBody') : t('landing.offersBody')}
        </Prose>
      </div>

      {albums.length === 0 ? (
        <EmptyState title={t('state.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album, i) => (
            <AlbumCard key={album.slug} album={album} index={i} />
          ))}
        </div>
      )}

      <div className="mt-12 flex justify-center">
        <Button asChild variant="gold" size="lg">
          <Link href="/albums">{t('landing.collectionViewAll')}</Link>
        </Button>
      </div>
    </Section>
  )
}
