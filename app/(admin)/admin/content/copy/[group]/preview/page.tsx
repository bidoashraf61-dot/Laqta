import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { renderTemplate, TEMPLATES, type TemplateName } from '@/emails/registry'
import { SAMPLE_PAYLOAD } from '@/emails/sample-payload'
import { t } from '@/lib/i18n'
import { isLocale } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return { title: t('dash.copy.previewEmail') }
}

/**
 * `/admin/content/copy/email/preview?template=&lang=[&copyPreview=]` — one
 * email, rendered as it would be sent, with sample data (DEV-64b).
 *
 * Rendered in this RSC pass, so with `copyPreview` the owner's unpublished
 * edits apply (the middleware sets the header for admins only) and without
 * it the published copy does. The message sits in a script-less iframe: it is
 * a whole HTML document with its own styles, and must not inherit the admin's.
 */
export default async function EmailPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>
  searchParams: Promise<{ template?: string; lang?: string }>
}) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  const uiLocale = await requestLocale()

  await requireAdmin()

  const { group } = await params
  if (group !== 'email') notFound()
  const { template: rawTemplate, lang } = await searchParams
  const template = (TEMPLATES as readonly string[]).includes(rawTemplate ?? '')
    ? (rawTemplate as TemplateName)
    : TEMPLATES[0]
  // Defaults to the admin's own language, so the page never mixes the two.
  const locale = isLocale(lang ?? '') ? (lang as 'ar' | 'en') : uiLocale

  const rendered = renderTemplate(template, locale, SAMPLE_PAYLOAD)

  return (
    <>
      <DashboardHeader
        title={t('dash.copy.emailPreviewTitle', { template: t(`dash.copy.template.${template.replace('.', '_')}`) })}
        description={t('dash.copy.emailPreviewHint')}
        back={{ href: '/admin/content/copy/email', label: t('dash.copy.group.email') }}
      />
      <Panel>
        <p className="mb-4 text-sm">
          <span className="text-muted-foreground">{t('dash.copy.emailSubject')}</span>{' '}
          <bdi lang={locale} className="font-medium">
            {rendered.subject}
          </bdi>
        </p>
        <iframe
          title={t('dash.copy.emailPreviewTitle', { template: t(`dash.copy.template.${template.replace('.', '_')}`) })}
          // Same origin so the message can load the site's fonts and logo; no
          // `allow-scripts`, so nothing in it runs (the contact form's
          // untrusted text is escaped by the template anyway).
          sandbox="allow-same-origin"
          srcDoc={rendered.html}
          className="h-[70dvh] w-full rounded-md border bg-card"
        />
      </Panel>
    </>
  )
}
