import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { auth } from '@/lib/auth'
import { direction, locale, t } from '@/lib/i18n'
import { Providers } from '@/components/layout/providers'
import { Toaster } from '@/components/ui/toast'
import '@/styles/globals.css'
import { THEME_SCRIPT } from '@/lib/theme'

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
    // Every page that does not set its own share card falls back to this one.
    // Without it a link pasted into WhatsApp — how this catalogue actually
    // travels between editors — renders as a bare URL with no picture.
    images: [{ url: '/hero/06-alula.jpg', width: 1920, height: 1080, alt: t('brand.tagline') }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${t('brand.name')} — ${t('brand.tagline')}`,
    description: t('brand.promise'),
    images: ['/hero/06-alula.jpg'],
  },
}

/**
 * The document shell.
 *
 * Arabic-only, so `lang` and `dir` are constants rather than route state, and
 * this is a plain root layout again — no `[locale]` segment and no
 * pass-through indirection.
 *
 * The document ground is paper. Dark is not the default any more; it is a
 * property of the FILM, scoped with `.dark` to the cinematic and to any
 * surface that holds footage. Light chrome around dark frames gives the
 * footage more contrast than a dark page ever did, and it is what the brief
 * asked for.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <head>
        {/* Sets html.dark before first paint. Anything React renders is too
            late — the page would paint paper and repaint ink. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <Providers session={session}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-gold-foreground"
          >
            {t('nav.skipToContent')}
          </a>
          {/* The site header and footer belong to the marketing and account
              surfaces, not to the document. The dashboards bring their own
              chrome — a sidebar and a top bar — and rendering the site header
              above that stacked two brands and two account menus on every
              studio and admin screen. */}
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
