import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { BackLink, DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { SettingsForm } from '@/components/dashboard/form'
import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { HUB_FAQ_MAX, HUB_INTRO_MAX, parseHubFaqs } from '@/lib/hub-page'
import { saveHubPage } from '@/app/(admin)/admin/actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('dash.hubPageTitle') }
}

/**
 * The text of one location or category page (DEV-41): the words Google and a
 * buyer read above the albums — SEO title and description, an intro, and up
 * to three questions and answers — in Arabic and English. Other kinds have no
 * public page and 404 here.
 */
export default async function HubPageEditor({ params }: { params: Promise<{ id: string }> }) {
  await requestLocale()
  await requireAdmin()
  const { id } = await params

  const term = await db.taxonomy.findUnique({ where: { id } })
  if (!term || (term.kind !== 'location' && term.kind !== 'category')) notFound()
  const faqs = parseHubFaqs(term.faqs)
  const path = `${term.kind === 'location' ? '/locations' : '/categories'}/${term.slug}`

  return (
    <>
      <BackLink href="/admin/taxonomy" label={t('dash.taxonomyTitle')} />
      <DashboardHeader
        title={t('dash.hubPageHeading', { name: term.nameAr })}
        description={t('dash.hubPageHint')}
        action={
          // A new tab onto the public page — a plain anchor, not a client route.
          <a href={path} target="_blank" rel="noopener" className="text-sm underline underline-offset-4">
            {t('dash.hubPageView')}
          </a>
        }
      />

      <SettingsForm action={saveHubPage.bind(null, term.id)} className="max-w-3xl">
        <Panel className="space-y-4 p-5">
          <h2 className="font-bold">{t('dash.hubPageSeo')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('dash.hubSeoTitleAr')} htmlFor="seoTitleAr" hint={t('dash.hubSeoTitleHint')}>
              <Input id="seoTitleAr" name="seoTitleAr" defaultValue={term.seoTitleAr ?? ''} maxLength={70} />
            </Field>
            <Field label={t('dash.hubSeoTitleEn')} htmlFor="seoTitleEn" hint={t('dash.hubSeoTitleHint')}>
              <Input id="seoTitleEn" name="seoTitleEn" dir="ltr" defaultValue={term.seoTitleEn ?? ''} maxLength={70} />
            </Field>
            <Field label={t('dash.hubSeoDescAr')} htmlFor="seoDescAr" hint={t('dash.hubSeoDescHint')}>
              <Textarea id="seoDescAr" name="seoDescAr" rows={3} defaultValue={term.seoDescAr ?? ''} maxLength={160} />
            </Field>
            <Field label={t('dash.hubSeoDescEn')} htmlFor="seoDescEn" hint={t('dash.hubSeoDescHint')}>
              <Textarea id="seoDescEn" name="seoDescEn" rows={3} dir="ltr" defaultValue={term.seoDescEn ?? ''} maxLength={160} />
            </Field>
          </div>
        </Panel>

        <Panel className="space-y-4 p-5">
          <h2 className="font-bold">{t('dash.hubPageIntro')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('dash.hubIntroAr')} htmlFor="introAr" hint={t('dash.hubIntroHint')}>
              <Textarea id="introAr" name="introAr" rows={6} defaultValue={term.introAr ?? ''} maxLength={HUB_INTRO_MAX} />
            </Field>
            <Field label={t('dash.hubIntroEn')} htmlFor="introEn">
              <Textarea id="introEn" name="introEn" rows={6} dir="ltr" defaultValue={term.introEn ?? ''} maxLength={HUB_INTRO_MAX} />
            </Field>
          </div>
        </Panel>

        <Panel className="space-y-5 p-5">
          <div>
            <h2 className="font-bold">{t('dash.hubPageFaq')}</h2>
            <p className="text-sm text-muted-foreground">{t('dash.hubFaqHint')}</p>
          </div>
          {Array.from({ length: HUB_FAQ_MAX }, (_, i) => {
            const faq = faqs[i]
            const n = i + 1
            return (
              <fieldset key={n} className="grid gap-3 border-t pt-4 first:border-0 first:pt-0 sm:grid-cols-2">
                <legend className="sr-only">{t('dash.hubFaqN', { n })}</legend>
                <Field label={t('dash.hubFaqQAr', { n })} htmlFor={`faq${n}QAr`}>
                  <Input id={`faq${n}QAr`} name={`faq${n}QAr`} defaultValue={faq?.qAr ?? ''} maxLength={200} />
                </Field>
                <Field label={t('dash.hubFaqQEn', { n })} htmlFor={`faq${n}QEn`}>
                  <Input id={`faq${n}QEn`} name={`faq${n}QEn`} dir="ltr" defaultValue={faq?.qEn ?? ''} maxLength={200} />
                </Field>
                <Field label={t('dash.hubFaqAAr', { n })} htmlFor={`faq${n}AAr`}>
                  <Textarea id={`faq${n}AAr`} name={`faq${n}AAr`} rows={3} defaultValue={faq?.aAr ?? ''} maxLength={700} />
                </Field>
                <Field label={t('dash.hubFaqAEn', { n })} htmlFor={`faq${n}AEn`}>
                  <Textarea id={`faq${n}AEn`} name={`faq${n}AEn`} rows={3} dir="ltr" defaultValue={faq?.aEn ?? ''} maxLength={700} />
                </Field>
              </fieldset>
            )
          })}
        </Panel>
      </SettingsForm>
    </>
  )
}
