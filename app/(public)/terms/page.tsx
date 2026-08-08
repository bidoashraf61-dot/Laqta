import Link from 'next/link'
import { DocumentPage } from '@/components/layout/document-page'
import { TERMS, EFFECTIVE_FROM } from '@/content/legal'
import { t } from '@/lib/i18n'

export const metadata = {
  alternates: { canonical: '/terms' },
  title: t('footer.terms'),
  description: t('brand.seo.terms'),
}

export default function TermsPage() {
  return (
    <DocumentPage
      title={t('footer.terms')}
      summary={t('brand.promise')}
      effectiveFrom={EFFECTIVE_FROM}
      sections={TERMS}
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
