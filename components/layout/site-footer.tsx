import Link from 'next/link'
import { Separator } from '@/components/ui/toggles'
import { LocaleSwitch } from '@/components/layout/locale-switch'
import { FOOTER_LEGAL } from '@/components/layout/nav'
import { getTranslator, type Locale } from '@/lib/i18n'

const SOCIAL = [
  { href: 'https://x.com/laqta_sa', label: 'X' },
  { href: 'https://instagram.com/laqta.sa', label: 'Instagram' },
  { href: 'https://youtube.com/@laqta', label: 'YouTube' },
  { href: 'https://linkedin.com/company/laqta', label: 'LinkedIn' },
]

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getTranslator(locale)
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="container py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm space-y-2">
            <p className="text-2xl font-bold text-gold">{t('brand.name')}</p>
            <p className="text-sm text-muted-foreground">{t('brand.tagline')}</p>
            <p className="text-sm text-muted-foreground">{t('brand.promise')}</p>
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm" aria-label={t('footer.about')}>
            {FOOTER_LEGAL.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t('footer.language')}</p>
            <LocaleSwitch locale={locale} />
            <ul className="flex gap-4 pt-2 text-sm">
              {SOCIAL.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="ltr-island text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <p className="text-xs text-muted-foreground">
          <span className="numeric">{year}</span> © {t('brand.name')} — {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}
