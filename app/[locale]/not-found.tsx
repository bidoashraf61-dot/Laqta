import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTranslator, defaultLocale } from '@/lib/i18n'

/**
 * `not-found.tsx` cannot read route params, so it renders in the default
 * locale. Arabic is the default, which is the right guess for a 404.
 */
export default function LocaleNotFound() {
  const t = getTranslator(defaultLocale)

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <FileQuestion className="size-12 text-muted-foreground" />
      <h1 className="text-headline font-semibold">{t('state.notFound')}</h1>
      <p className="max-w-md text-muted-foreground">{t('state.notFoundHint')}</p>
      <Button asChild variant="outline">
        <Link href={`/${defaultLocale}`}>{t('state.backHome')}</Link>
      </Button>
    </div>
  )
}
