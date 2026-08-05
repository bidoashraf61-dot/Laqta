import Link from 'next/link'
import { DocumentPage } from '@/components/layout/document-page'
import { PRIVACY, EFFECTIVE_FROM } from '@/content/legal'
import { t } from '@/lib/i18n'

export const metadata = {
  title: t('footer.privacy'),
  description: t('brand.promise'),
}

export default function PrivacyPage() {
  return (
    <DocumentPage
      title={t('footer.privacy')}
      summary={t('brand.promise')}
      effectiveFrom={EFFECTIVE_FROM}
      sections={PRIVACY}
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
