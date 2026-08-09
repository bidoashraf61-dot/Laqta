import { Link } from '@/components/ui/link'
import { Separator } from '@/components/ui/toggles'
import { FOOTER_LEGAL } from '@/components/layout/nav'
import { t } from '@/lib/i18n'
import { SOCIAL } from '@/lib/brand'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="on-olive border-t border-border bg-background text-foreground">
      <div className="container py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm space-y-2">
            <p className="font-display text-2xl font-bold text-gold">{t('brand.name')}</p>
            <p className="text-sm text-muted-foreground">{t('brand.tagline')}</p>
            <p className="text-sm text-muted-foreground">{t('brand.promise')}</p>
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm" aria-label={t('footer.about')}>
            {FOOTER_LEGAL.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t('footer.follow')}</p>
            <ul className="flex gap-4 text-sm">
              {SOCIAL.map((item) => (
                <li key={item.label}>
                  {/* Platform names are proper nouns — Latin, but isolated. */}
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

        {/* The production-method disclosure is not here. It lives in the
            content policy, which is the document that BINDS — a footer badge is
            marketing chrome, and the policy is what a buyer can hold us to. */}
        <p className="text-xs text-muted-foreground">
          <span className="numeric">{year}</span> © {t('brand.name')} — {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}
