import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/auth'
import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { SettingsForm } from '@/components/dashboard/form'
import { createAlbum } from '@/app/(studio)/studio/actions'
import { t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('studio.newAlbum'),
  }
}

/**
 * New album.
 *
 * Deliberately short: title and description. No price and no band — Laqta sets
 * the price at approval (DEV-09). Clips arrive afterwards, on the album's own
 * page.
 */
export default async function NewAlbumPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  return (
    <>
      <DashboardHeader title={t('studio.newAlbum')} description={t('dash.newAlbumHint')} />

      <Panel>
        <SettingsForm action={createAlbum} submitLabel={t('dash.create')} className="max-w-2xl">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('dash.albumTitleAr')} htmlFor="titleAr" required>
              <Input id="titleAr" name="titleAr" required maxLength={120} />
            </Field>
            <Field label={t('dash.albumTitleEn')} htmlFor="titleEn" required>
              <Input id="titleEn" name="titleEn" required maxLength={120} dir="ltr" />
            </Field>
          </div>

          <Field label={t('dash.albumDescAr')} htmlFor="descriptionAr">
            <Textarea id="descriptionAr" name="descriptionAr" rows={3} maxLength={1000} />
          </Field>
          <Field label={t('dash.albumDescEn')} htmlFor="descriptionEn">
            <Textarea id="descriptionEn" name="descriptionEn" rows={3} maxLength={1000} dir="ltr" />
          </Field>

        </SettingsForm>
      </Panel>
    </>
  )
}
