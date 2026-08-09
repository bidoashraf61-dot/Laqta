import { Link } from '@/components/ui/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { requestLocale } from '@/lib/locale-request'

export default async function NotFound() {
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
