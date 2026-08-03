import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTranslator, isLocale, defaultLocale, type Locale } from '@/lib/i18n'

/**
 * Landing placeholder.
 *
 * Brief 02 owns `/` and replaces this wholesale with the scroll-cinematic.
 * It exists so `npm run dev` serves something coherent on both locales and so
 * the header, footer, tokens and fonts have a page to be seen on.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : defaultLocale
  const t = getTranslator(locale)

  const promises = [
    t('commerce.oneTimePurchase'),
    t('commerce.ownForever'),
    t('commerce.instantDownload'),
    t('commerce.taxInvoice'),
    t('commerce.arabicSupport'),
  ]

  return (
    <div className="container py-20">
      <section className="max-w-3xl space-y-6">
        <Badge variant="gold">{t('state.scaffold')}</Badge>
        <h1 className="text-display font-bold text-gold">{t('brand.name')}</h1>
        <p className="text-headline text-balance">{t('brand.tagline')}</p>
        <p className="text-lg text-muted-foreground">{t('brand.promise')}</p>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="gold" size="lg">
            <Link href={`/${locale}/footage`}>{t('nav.footage')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/${locale}/sell`}>{t('nav.sell')}</Link>
          </Button>
        </div>

        <ul className="flex flex-wrap gap-2 pt-4">
          {promises.map((promise) => (
            <li key={promise}>
              <Badge variant="neutral">{promise}</Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['gold', 'sand', 'clay', 'oasis'] as const).map((name) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle className="flex items-baseline gap-2 text-sm">
                {t(`palette.${name}`)}
                {/* The CSS custom property is an identifier, not copy — it stays
                    Latin, but must be isolated so it reads correctly in Arabic. */}
                <span className="ltr-island text-xs font-normal text-muted-foreground">
                  --{name}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="h-16 w-full rounded-md"
                style={{ backgroundColor: `hsl(var(--${name}))` }}
              />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
