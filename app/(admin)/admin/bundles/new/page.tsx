import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { DashboardHeader } from '@/components/dashboard/primitives'
import { BundleEditor } from '@/components/admin/bundle-editor'
import { editorAlbums } from '../editor-data'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return { title: t('dash.bundles.new') }
}

/** `/admin/bundles/new` — build a bundle (DEV-62). */
export default async function NewBundlePage() {
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

  return (
    <>
      <DashboardHeader
        title={t('dash.bundles.new')}
        description={t('dash.bundles.editHint')}
        back={{ href: '/admin/bundles', label: t('dash.bundles.title') }}
      />
      <BundleEditor albums={await editorAlbums()} bundle={null} />
    </>
  )
}
