import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <FileQuestion className="size-12 text-muted-foreground" />
      <PageTitle>{t('state.notFound')}</PageTitle>
      <p className="max-w-md text-muted-foreground">{t('state.notFoundHint')}</p>
      <Button asChild variant="outline">
        <Link href="/">{t('state.backHome')}</Link>
      </Button>
    </div>
  )
}
