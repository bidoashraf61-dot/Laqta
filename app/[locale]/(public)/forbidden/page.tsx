import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'

/**
 * 403. `middleware.ts` *rewrites* here rather than redirecting, so the URL the
 * user typed stays in the address bar — they can hand it to whoever does have
 * the right role instead of losing it.
 */
export default async function ForbiddenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale
  const t = getTranslator(locale)

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <ShieldAlert className="size-12 text-warning" />
      <h1 className="text-headline font-semibold">{t('state.forbidden')}</h1>
      <p className="max-w-md text-muted-foreground">{t('state.forbiddenHint')}</p>
      <Button asChild variant="outline">
        <Link href={`/${locale}`}>{t('state.backHome')}</Link>
      </Button>
    </div>
  )
}
