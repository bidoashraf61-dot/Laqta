import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'

/**
 * Temporary home. Brief 02 replaces this with the scroll cinematic.
 */
export default function HomePage() {
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
        <p className="text-balance text-headline">{t('brand.tagline')}</p>
        <p className="text-lg text-muted-foreground">{t('brand.promise')}</p>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="gold" size="lg">
            <Link href="/footage">{t('nav.footage')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/sell">{t('nav.sell')}</Link>
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
    </div>
  )
}
