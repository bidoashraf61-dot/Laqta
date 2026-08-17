import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { EmptyState } from '@/components/ui/state'
import { Headline, Section } from '@/components/ui/typography'
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
    <Section tone="olive">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Headline lead={t('landing.collectionLead')} bold={t('landing.collectionBold')} size="lg" />
        <p className="mt-4 text-muted-foreground">{t('landing.collectionBody')}</p>
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

      {/* Occasion hook, then the way through to the full catalogue. */}
      <p className="mt-12 text-center font-serif text-lg text-foreground/80">
        {t('landing.collectionOccasion')}
      </p>
      <div className="mt-6 flex justify-center">
        <Button asChild variant="gold" size="lg">
          <Link href="/albums">{t('landing.collectionViewAll')}</Link>
        </Button>
      </div>
    </Section>
  )
}
