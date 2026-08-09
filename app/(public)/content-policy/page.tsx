import { Link } from '@/components/ui/link'
import { DocumentPage } from '@/components/layout/document-page'
import { CONTENT_POLICY, EFFECTIVE_FROM } from '@/content/legal'
import { t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    alternates: localeAlternates('/content-policy'),
    title: t('footer.contentPolicy'),
    description: t('brand.seo.contentPolicy'),
  }
}

export default async function ContentPolicyPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  return (
    <DocumentPage
      title={t('footer.contentPolicy')}
      summary={t('brand.promise')}
      effectiveFrom={EFFECTIVE_FROM}
      sections={CONTENT_POLICY}
      footer={
        <p className="text-sm text-muted-foreground">
          {t('legal.questions')}{' '}
          <Link href="/contact" className="text-gold underline underline-offset-4">
            {t('legal.contactUs')}
          </Link>
        </p>
      }
    />
  )
}
