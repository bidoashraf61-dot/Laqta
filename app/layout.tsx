import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { auth } from '@/lib/auth'
import { activeCopy, isCopyPreview, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { DIRECTION, HTML_LANG, localePath } from '@/lib/locale'
import { LocaleProvider } from '@/components/layout/locale-provider'
import { Providers } from '@/components/layout/providers'
import { RouteProgress } from '@/components/layout/route-progress'
import { RevealScope } from '@/components/ui/reveal'
import { Toaster } from '@/components/ui/toast'
import { ImpersonationBanner } from '@/components/layout/impersonation-banner'
import { CopyPreviewBanner } from '@/components/layout/copy-preview-banner'
import '@/styles/globals.css'
import { THEME_SCRIPT } from '@/lib/theme'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

export const viewport: Viewport = {
  themeColor: '#14141A',
  width: 'device-width',
  initialScale: 1,
}

/**
 * `generateMetadata`, not a `metadata` constant.
 *
 * A module-scope `export const metadata = { title: t(...) }` is evaluated once,
 * when the module first loads — before any request exists. Every visitor would
 * get whichever language was current at import time, which is always the
 * default. Metadata that depends on the request has to be generated per
 * request, and that is the entire reason this is a function.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale()
  const title = `${t('brand.name')} — ${t('brand.tagline')}`

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${t('brand.name')}` },
    description: t('brand.promise'),
    alternates: {
      // Both languages named on both sides, so a crawler landing on either one
      // knows the other exists and neither is read as duplicate content.
      languages: {
        ar: localePath('ar', '/'),
        en: localePath('en', '/'),
        'x-default': localePath('ar', '/'),
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'en' ? 'en' : 'ar_SA',
      siteName: t('brand.name'),
      title,
      description: t('brand.promise'),
      // Every page that does not set its own share card falls back to this one.
      // Without it a link pasted into WhatsApp — how this catalogue actually
      // travels between editors — renders as a bare URL with no picture.
      images: [{ url: '/hero/06-alula.jpg', width: 1920, height: 1080, alt: t('brand.tagline') }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: t('brand.promise'),
      images: ['/hero/06-alula.jpg'],
    },
  }
}

/**
 * The document shell.
 *
 * ── Where the locale is decided ─────────────────────────────────────────────
 * The middleware rewrites `/en/*` onto the bare route and names the language in
 * a request header. This layout reads that header and seeds the store — and
 * because React finishes rendering a parent before it starts on that parent's
 * children, every `t()` below this point sees the right language. That ordering
 * IS the mechanism; lib/locale.ts records why the obvious alternatives are not.
 *
 * Client components do not read that store — they cannot; see lib/i18n-client —
 * so `LocaleProvider` carries the same value down to them by context.
 *
 * The document ground is paper. Dark is not the default any more; it is a
 * property of the FILM, scoped with `.dark` to the cinematic and to any
 * surface that holds footage. Light chrome around dark frames gives the
 * footage more contrast than a dark page ever did, and it is what the brief
 * asked for.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  // Before `auth()`: this must be the first thing the tree resolves.
  const locale = await requestLocale()
  const session = await auth()

  return (
    <html lang={HTML_LANG[locale]} dir={DIRECTION[locale]} suppressHydrationWarning>
      <head>
        {/* Sets html.dark before first paint. Anything React renders is too
            late — the page would paint paper and repaint ink. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        {/* The owner's edited copy (DEV-64b) reaches client components here;
            server components read it inside translate(). */}
        <LocaleProvider locale={locale} copy={activeCopy(locale)}>
          <Providers session={session}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-gold-foreground"
            >
              {t('nav.skipToContent')}
            </a>
            {/* The site header and footer belong to the marketing and account
              surfaces, not to the document. The dashboards bring their own
              chrome — a sidebar and a top bar — and rendering the site header
              above that stacked two brands and two account menus on every
              studio and admin screen. */}
            {children}
            {session?.user?.impersonation ? (
              <ImpersonationBanner view={session.user.impersonation} />
            ) : null}
            {isCopyPreview() ? <CopyPreviewBanner /> : null}
            {/* Both are engines, not chrome: they render nothing until there
                is something to reveal or a navigation to report. They live at
                the document root because both watch the whole document — the
                dashboards bring their own shell, but they still stream content
                in and still navigate. */}
            <RevealScope />
            <RouteProgress />
            <Toaster />
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  )
}
