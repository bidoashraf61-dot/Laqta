import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTranslator, isLocale, localeDirection, locales, type Locale } from '@/lib/i18n'
import { Providers } from '@/components/layout/providers'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { Toaster } from '@/components/ui/toast'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  themeColor: '#14141A',
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslator(isLocale(locale) ? locale : 'ar')
  return {
    title: { default: `${t('brand.name')} — ${t('brand.tagline')}`, template: `%s · ${t('brand.name')}` },
    description: t('brand.promise'),
    metadataBase: new URL(process.env.AUTH_URL ?? 'http://localhost:3000'),
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: '/ar', en: '/en' },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'ar' ? 'ar_SA' : 'en_GB',
      siteName: t('brand.name'),
    },
  }
}

/**
 * The document shell.
 *
 * `dir` is set from the locale here and nowhere else — no component should
 * ever read the direction off `navigator` or hard-code it. Dark is the default
 * theme because the hero cinematic is dark and the catalogue sits inside it.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()
  const locale: Locale = raw

  const session = await auth()
  const t = getTranslator(locale)

  return (
    <html lang={locale} dir={localeDirection[locale]} className="dark" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <Providers locale={locale} session={session}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-ink"
          >
            {t('nav.skipToContent')}
          </a>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader locale={locale} session={session} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter locale={locale} />
          </div>
          <Toaster locale={locale} />
        </Providers>
      </body>
    </html>
  )
}
