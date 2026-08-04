import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { auth } from '@/lib/auth'
import { direction, locale, t } from '@/lib/i18n'
import { Providers } from '@/components/layout/providers'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { Toaster } from '@/components/ui/toast'
import '@/styles/globals.css'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

export const viewport: Viewport = {
  themeColor: '#14141A',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${t('brand.name')} — ${t('brand.tagline')}`,
    template: `%s · ${t('brand.name')}`,
  },
  description: t('brand.promise'),
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    siteName: t('brand.name'),
    title: `${t('brand.name')} — ${t('brand.tagline')}`,
    description: t('brand.promise'),
  },
  twitter: { card: 'summary_large_image' },
}

/**
 * The document shell.
 *
 * Arabic-only, so `lang` and `dir` are constants rather than route state, and
 * this is a plain root layout again — no `[locale]` segment and no
 * pass-through indirection. Dark is the default: the site sits inside the
 * hero cinematic.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  return (
    <html lang={locale} dir={direction} className="dark" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <Providers session={session}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-ink"
          >
            {t('nav.skipToContent')}
          </a>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader session={session} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
