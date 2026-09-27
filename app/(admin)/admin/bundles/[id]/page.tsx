import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { BundleEditor } from '@/components/admin/bundle-editor'
import { editorAlbums } from '../editor-data'
import { t } from '@/lib/i18n'
import { pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return { title: t('dash.bundles.edit') }
}

/** `/admin/bundles/[id]` — edit a bundle (DEV-62). */
export default async function EditBundlePage({ params }: { params: Promise<{ id: string }> }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  await requireAdmin()

  const { id } = await params
  const bundle = await db.bundle.findUnique({
    where: { id },
    include: { albums: { orderBy: { position: 'asc' }, select: { albumId: true } } },
  })
  if (!bundle) notFound()

  return (
    <>
      <DashboardHeader
        title={pickLocalised(bundle.titleAr, bundle.titleEn)}
        description={t('dash.bundles.editHint')}
        back={{ href: '/admin/bundles', label: t('dash.bundles.title') }}
      />
      <BundleEditor
        albums={await editorAlbums()}
        bundle={{
          id: bundle.id,
          slug: bundle.slug,
          titleAr: bundle.titleAr,
          titleEn: bundle.titleEn ?? '',
          descriptionAr: bundle.descriptionAr ?? '',
          descriptionEn: bundle.descriptionEn ?? '',
          pricing: bundle.pricing,
          value: String(Number(bundle.value)),
          startsAt: bundle.startsAt?.toISOString() ?? null,
          endsAt: bundle.endsAt?.toISOString() ?? null,
          isActive: bundle.isActive,
          albumIds: bundle.albums.map((row) => row.albumId),
        }}
      />
    </>
  )
}
