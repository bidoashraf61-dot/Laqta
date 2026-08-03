import Link from 'next/link'
import '@/styles/globals.css'
import { defaultLocale, localeDirection, getTranslator } from '@/lib/i18n'

/**
 * Root 404, for the handful of paths that fall outside a locale segment.
 *
 * It emits its own `<html>`/`<body>` because the root layout is a pass-through
 * — see app/layout.tsx. Locale-prefixed 404s use app/[locale]/not-found.tsx and
 * get the full site chrome.
 */
export default function RootNotFound() {
  const t = getTranslator(defaultLocale)

  return (
    <html lang={defaultLocale} dir={localeDirection[defaultLocale]} className="dark">
      <body className="grid min-h-dvh place-items-center bg-background font-sans text-foreground">
        <div className="space-y-4 text-center">
          <h1 className="text-headline font-semibold">{t('state.notFound')}</h1>
          <p className="text-muted-foreground">{t('state.notFoundHint')}</p>
          <Link href={`/${defaultLocale}`} className="text-gold underline underline-offset-4">
            {t('state.backHome')}
          </Link>
        </div>
      </body>
    </html>
  )
}
