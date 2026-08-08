import Link from 'next/link'
import { DocumentPage } from '@/components/layout/document-page'
import { LICENCES, EFFECTIVE_FROM } from '@/content/legal'
import { t } from '@/lib/i18n'

export const metadata = {
  alternates: { canonical: '/licences' },
  title: t('footer.licences'),
  description: t('brand.seo.licences'),
}

export default function LicencesPage() {
  return (
    <DocumentPage
      title={t('footer.licences')}
      summary={t('brand.promise')}
      effectiveFrom={EFFECTIVE_FROM}
      sections={LICENCES}
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
