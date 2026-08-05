import Link from 'next/link'
import { DocumentPage } from '@/components/layout/document-page'
import { CONTACT } from '@/content/legal'
import { t } from '@/lib/i18n'

export const metadata = {
  title: t('footer.contact'),
  description: t('brand.promise'),
}

export default function ContactPage() {
  return (
    <DocumentPage
      title={t('footer.contact')}
      summary={t('brand.promise')}
      sections={CONTACT}
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
