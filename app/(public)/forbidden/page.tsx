import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'

/**
 * 403. middleware.ts *rewrites* here rather than redirecting, so the URL the
 * user typed stays in the address bar — they can hand it to whoever does have
 * the right role instead of losing it.
 */
export default function ForbiddenPage() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <ShieldAlert className="size-12 text-warning" />
      <PageTitle>{t('state.forbidden')}</PageTitle>
      <p className="max-w-md text-muted-foreground">{t('state.forbiddenHint')}</p>
      <Button asChild variant="outline">
        <Link href="/">{t('state.backHome')}</Link>
      </Button>
    </div>
  )
}
