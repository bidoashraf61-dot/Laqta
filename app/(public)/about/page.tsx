import Link from 'next/link'
import { DocumentPage } from '@/components/layout/document-page'
import { ABOUT } from '@/content/legal'
import { t } from '@/lib/i18n'

export const metadata = {
  title: t('footer.about'),
  description: t('brand.promise'),
}

export default function AboutPage() {
  return (
    <DocumentPage
      title={t('footer.about')}
      summary={t('brand.promise')}
      sections={ABOUT}
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
