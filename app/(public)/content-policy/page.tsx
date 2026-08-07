import Link from 'next/link'
import { DocumentPage } from '@/components/layout/document-page'
import { CONTENT_POLICY, EFFECTIVE_FROM } from '@/content/legal'
import { t } from '@/lib/i18n'

export const metadata = {
  title: t('footer.contentPolicy'),
  description: t('brand.seo.contentPolicy'),
}

export default function ContentPolicyPage() {
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
