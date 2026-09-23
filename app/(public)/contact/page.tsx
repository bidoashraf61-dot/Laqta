import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/contact-form'
import { Headline, Prose } from '@/components/ui/typography'
import { CONTACT } from '@/content/legal'
import { contactChannels, displayWhatsapp } from '@/content/contact'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates, pickLocalised } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    alternates: localeAlternates('/contact'),
    title: t('footer.contact'),
    description: t('brand.seo.contact'),
  }
}

/**
 * /contact — the form, the direct lines, and who we are.
 *
 * ── Complete with none, some or all channels set ────────────────────────────
 * The WhatsApp number, support email, company address and CR number are the
 * owner's to supply (content/contact.ts). Each renders only when set, so the
 * page never shows a placeholder: with none of them it is the form beside the
 * guidance, which is a whole page on its own; each value that arrives adds one
 * line in the place it belongs.
 *
 * ── Composition ─────────────────────────────────────────────────────────────
 * The two-cut head (Sans Light lead, Serif Display statement, Serif Text
 * prose) is the site standard. The direct lines sit in the head, not in a
 * sidebar, because on a phone WhatsApp is the fastest route and must be above
 * the form, not three screens below it. The guidance is the old document copy
 * (CONTACT in content/legal.ts), now read beside the form it describes.
 */
export default async function ContactPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const { whatsapp, email, company } = contactChannels()
  const companyName = pickLocalised(company.nameAr, company.nameEn || null)
  const companyAddress = pickLocalised(company.addressAr, company.addressEn || null)
  const hasDirect = Boolean(whatsapp || email)
  const hasCompany = Boolean(companyName || companyAddress || company.crNumber)

  return (
    <article className="container-tight py-16 lg:py-24">
      <header className="max-w-[62ch]">
        <Headline as="h1" lead={t('contact.lead')} bold={t('contact.bold')} />
        <Prose className="mt-5">{t('contact.intro')}</Prose>

        {hasDirect ? (
          <section aria-labelledby="contact-direct" className="mt-10">
            <h2 id="contact-direct" className="text-sm font-medium text-muted-foreground">
              {t('contact.directTitle')}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-12 gap-y-5">
              {whatsapp ? (
                <li>
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block py-1"
                  >
                    <span className="block text-sm text-muted-foreground">
                      {t('contact.whatsapp')}
                    </span>
                    <span className="mt-1 block font-sans text-xl underline decoration-border decoration-1 underline-offset-[6px] transition-colors duration-hover ease-lens group-hover:decoration-foreground">
                      <span className="numeric" dir="ltr">
                        {displayWhatsapp(whatsapp)}
                      </span>
                    </span>
                    <span className="sr-only">{t('contact.whatsappNewTab')}</span>
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className="group block py-1">
                    <span className="block text-sm text-muted-foreground">
                      {t('contact.emailChannel')}
                    </span>
                    <span className="mt-1 block font-sans text-xl underline decoration-border decoration-1 underline-offset-[6px] transition-colors duration-hover ease-lens group-hover:decoration-foreground">
                      <span className="ltr-island" dir="ltr">
                        {email}
                      </span>
                    </span>
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </header>

      <div className="mt-14 grid items-start gap-14 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-20">
        <ContactForm />

        <aside aria-labelledby="contact-guide" className="lg:pt-10">
          <h2 id="contact-guide" className="font-subhead text-xl font-bold">
            {t('contact.guideTitle')}
          </h2>
          <div className="mt-6 space-y-7">
            {CONTACT.map((section) => (
              <section key={section.heading}>
                <h3 className="font-sans text-base font-medium">
                  {pickLocalised(section.heading, section.headingEn)}
                </h3>
                {pickLocalised(section.body, section.bodyEn).map((paragraph) => (
                  <p key={paragraph} className="mt-1.5 font-serif leading-[1.85] text-foreground/75">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </aside>
      </div>

      {hasCompany ? (
        <footer className="mt-20 border-t pt-8">
          <h2 className="text-sm font-medium text-muted-foreground">{t('contact.companyTitle')}</h2>
          <dl className="mt-4 grid gap-x-12 gap-y-4 text-sm sm:grid-cols-[repeat(auto-fit,minmax(12rem,max-content))]">
            {companyName ? (
              <div>
                <dt className="sr-only">{t('contact.companyName')}</dt>
                <dd className="font-medium">{companyName}</dd>
              </div>
            ) : null}
            {companyAddress ? (
              <div>
                <dt className="text-muted-foreground">{t('contact.address')}</dt>
                <dd className="mt-1 whitespace-pre-line not-italic">
                  <address className="not-italic">{companyAddress}</address>
                </dd>
              </div>
            ) : null}
            {company.crNumber ? (
              <div>
                <dt className="text-muted-foreground">{t('contact.crNumber')}</dt>
                <dd className="mt-1">
                  <span className="numeric">{company.crNumber}</span>
                </dd>
              </div>
            ) : null}
          </dl>
        </footer>
      ) : null}
    </article>
  )
}
