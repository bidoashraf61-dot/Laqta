import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Link } from '@/components/ui/link'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { Headline, Prose } from '@/components/ui/typography'
import { SubmitButton } from '@/components/dashboard/form'
import { auth } from '@/lib/auth'
import { countOf, formatNumber, t } from '@/lib/i18n'
import { currentLocale, localeAlternates, localePath, pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'
import { mediaUrl } from '@/lib/media'
import { getPublicSample, sampleEntitlementFor } from '@/lib/sample'
import { claimSampleAction } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return {
    alternates: localeAlternates('/sample'),
    title: t('sample.seoTitle'),
    description: t('sample.seoDescription'),
  }
}

/**
 * The free sample album — owner decision 2026-09-24.
 *
 * Signed-in accounts claim it once; it lands in the library through the same
 * frozen entitlement path as a purchase (`lib/orders.ts#claimSample`). Every
 * clip names and links the album it is sold in: the sample exists to send a
 * visitor to an album.
 */
export default async function SamplePage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>
}) {
  await requestLocale()
  const locale = currentLocale()

  const session = await auth()
  const userId = session?.user?.id ?? null
  const isAdmin = session?.user?.role === 'admin'

  // An admin can preview an unpublished sample; everyone else gets a 404.
  const sample = await getPublicSample({ includeDraft: isAdmin })
  if (!sample) notFound()

  const claimed = userId ? await sampleEntitlementFor(userId, sample.albumId) : null
  const { claim } = await searchParams
  const here = localePath(locale, '/sample')

  return (
    <div className="container-tight py-16">
      {!sample.isPublished ? (
        <Alert variant="warning" className="mb-8">
          <AlertDescription>{t('sample.draftNotice')}</AlertDescription>
        </Alert>
      ) : null}

      <header className="max-w-2xl">
        <Headline
          as="h1"
          size="lg"
          lead={t('sample.lead')}
          bold={pickLocalised(sample.titleAr, sample.titleEn)}
        />
        <Prose className="mt-5">
          {sample.descriptionAr || sample.descriptionEn ? (
            <Bilingual ar={sample.descriptionAr ?? ''} en={sample.descriptionEn} />
          ) : (
            t('sample.body', { clips: countOf('clip', sample.clips.length) })
          )}
        </Prose>

        <div className="mt-8 space-y-3">
          {claim === 'unavailable' ? (
            <p role="status" className="text-sm font-medium text-warning">
              {t('sample.unavailable')}
            </p>
          ) : null}

          {claimed && !claimed.revokedAt ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-medium">{t('sample.claimed')}</p>
              <Button asChild variant="outline">
                <Link href={`/account/library/${claimed.id}`}>{t('sample.openLibrary')}</Link>
              </Button>
            </div>
          ) : userId ? (
            <form action={claimSampleAction}>
              <SubmitButton variant="gold" size="lg">
                {t('sample.claim')}
              </SubmitButton>
            </form>
          ) : (
            <>
              <Button asChild variant="gold" size="lg">
                <Link href={`/sign-in?callbackUrl=${encodeURIComponent(here)}`}>{t('sample.signIn')}</Link>
              </Button>
              <p className="text-sm text-muted-foreground">{t('sample.signInNote')}</p>
            </>
          )}
        </div>
      </header>

      <section className="mt-16">
        <h2 className="mb-6 font-subhead text-subhead font-medium">{t('sample.clipsTitle')}</h2>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sample.clips.map((clip) => {
            const poster = mediaUrl(clip.thumbnailKeys[0] ?? null)
            const albumTitle = pickLocalised(clip.album.titleAr, clip.album.titleEn)
            const albumHref = `/albums/${clip.album.creator.handle}/${clip.album.slug}`
            return (
              <li key={clip.id} className="overflow-hidden rounded-lg border bg-card">
                <div className="aspect-video bg-ink">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt={pickLocalised(clip.titleAr, clip.titleEn)}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-4">
                  <p className="font-medium">
                    <Bilingual ar={clip.titleAr} en={clip.titleEn} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('sample.fromAlbum', { album: albumTitle })}
                  </p>
                  <Link
                    href={albumHref}
                    className="inline-block pt-1 text-sm font-medium underline underline-offset-4 hover:text-gold"
                  >
                    {t('sample.fromAlbumCta')}
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
