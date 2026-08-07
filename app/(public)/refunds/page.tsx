import Link from 'next/link'
import { DocumentPage } from '@/components/layout/document-page'
import { REFUNDS, EFFECTIVE_FROM } from '@/content/legal'
import { t } from '@/lib/i18n'

export const metadata = {
  title: t('footer.refunds'),
  description: t('brand.seo.refunds'),
}

export default function RefundsPage() {
  return (
    <DocumentPage
      title={t('footer.refunds')}
      summary={t('brand.promise')}
      effectiveFrom={EFFECTIVE_FROM}
      sections={REFUNDS}
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
