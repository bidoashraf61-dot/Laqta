import { Link } from '@/components/ui/link'
import { BadgeCheck, Coins, FileCheck2, Send, Upload } from 'lucide-react'
import { db } from '@/lib/db'
import { TIER_RATES, TIER_THRESHOLDS_USD, EXCLUSIVE_BONUS_POINTS } from '@/lib/commission'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Headline, Prose, Section } from '@/components/ui/typography'
import { formatMoney, formatNumber, formatPercent, t } from '@/lib/i18n'
import { FaqSchema } from '@/components/catalogue/faq-schema'
import type { Metadata } from 'next'
import { REVEAL } from '@/lib/motion'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    alternates: localeAlternates('/sell'),
    title: t('sell.title'),
    description: t('sell.intro'),
  }
}

const TIER_LABEL = {
  standard: 'dash.tierStandard',
  silver: 'dash.tierSilver',
  gold: 'dash.tierGold',
} as const

/**
 * Creator recruitment.
 *
 * Persuade mode: the visitor is deciding whether to hand us their work, so the
 * page leads with the number they actually care about — their share — and then
 * answers the two objections that kill the decision: "do I lose my rights"
 * (no, non-exclusive by default) and "will you change the rate later" (you
 * can't, it freezes at the sale).
 *
 * `/studio` redirects here when a signed-in user has no creator profile, so
 * this page is also the entry point of the creator funnel, not just marketing.
 */
/** The six checks a creator can run against their own album before submitting. */
const ALBUM_RULES = [
  'albumRule1',
  'albumRule2',
  'albumRule3',
  'albumRule4',
  'albumRule5',
  'albumRule6',
] as const

export default async function SellPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const [clips, creators] = await Promise.all([
    db.clip.count({ where: { album: { status: 'live' } } }),
    db.creator.count({ where: { status: 'approved' } }),
  ])

  const tiers = (['standard', 'silver', 'gold'] as const).map((tier) => ({
    tier,
    label: t(TIER_LABEL[tier]),
    share: 1 - TIER_RATES[tier],
    threshold: TIER_THRESHOLDS_USD[tier],
  }))

  const steps = [
    { icon: Upload, title: t('sell.how1Title'), body: t('sell.how1Body') },
    { icon: BadgeCheck, title: t('sell.how2Title'), body: t('sell.how2Body') },
    { icon: Send, title: t('sell.how3Title'), body: t('sell.how3Body') },
    { icon: Coins, title: t('sell.how4Title'), body: t('sell.how4Body') },
  ]

  const faqs = [
    { q: t('sell.faq1Q'), a: t('sell.faq1A') },
    { q: t('sell.faq2Q'), a: t('sell.faq2A') },
    { q: t('sell.faq3Q'), a: t('sell.faq3A') },
    { q: t('sell.faq4Q'), a: t('sell.faq4A') },
  ]

  return (
    <>
      <section className="container-tight py-20 lg:py-28">
        <Headline
          as="h1"
          size="display"
          lead={t('sell.lead')}
          bold={t('sell.boldLead')}
          className="max-w-3xl"
        />
        <Prose className="mt-6 max-w-xl">{t('sell.intro')}</Prose>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="gold" size="lg">
            <Link href="/sign-up?role=creator">{t('sell.apply')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/albums">{t('sell.browseFirst')}</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          <span className="numeric">{formatNumber(clips)}</span> {t('landing.trustClips')}
          {' · '}
          <span className="numeric">{formatNumber(creators)}</span> {t('landing.trustCreators')}
        </p>
      </section>

      {/* The number they came for. */}
      <Section tone="raised">
        <Headline lead={t('sell.shareTitle')} bold={t('sell.shareHint')} size="lg" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.tier} className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">{tier.label}</p>
              <p className="numeric mt-2 text-4xl font-bold text-gold">
                {formatPercent(tier.share, 0)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {tier.threshold === 0 ? (
                  t('dash.tierStandard')
                ) : (
                  <>
                    {t('sell.tierThreshold')}{' '}
                    <span className="numeric">{formatMoney(tier.threshold)}</span>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {t('dash.exclusive')}: +
          <span className="numeric">{formatPercent(EXCLUSIVE_BONUS_POINTS, 0)}</span>
        </p>
      </Section>

      <Section>
        <Headline lead={t('sell.howTitle')} bold={t('brand.tagline')} size="lg" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Card key={step.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-gold/15 text-gold">
                    <step.icon className="size-5" />
                  </span>
                  <span className="numeric text-sm text-muted-foreground">{index + 1}</span>
                </div>
                <CardTitle className="pt-2 text-base">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/*
        How to build an album that sells.

        This is the section a creator most needs and the one that was missing.
        Everything else on this page answers "what do I get?"; nothing answered
        "what am I supposed to make?", so the obvious guess is a folder of
        unrelated clips — which is the single most common reason an album is
        rejected at review, and the most expensive one, because it is only
        discovered after the work of uploading.

        Stated as rules with a reason attached to each, not as encouragement.
        A creator can check their own album against these before submitting it.
      */}
      <Section tone="offwhite">
        <div className="mx-auto max-w-2xl text-center">
          <Headline lead={t('sell.albumRulesTitle')} bold={t('sell.albumRulesBold')} size="lg" />
          <Prose className="mx-auto mt-5">{t('sell.albumRulesLead')}</Prose>
        </div>

        <ol className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALBUM_RULES.map((key, index) => (
            <li key={key} className="rounded-lg border bg-card p-5" {...REVEAL}>
              <span className="numeric font-display text-2xl font-bold text-gold">{index + 1}</span>
              <h3 className="mt-1 font-subhead text-base font-bold">{t(`sell.${key}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`sell.${key}Body`)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* The two objections that actually stop a creator signing up. */}
      <Section tone="raised">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="flex items-center gap-2 font-subhead text-lg font-bold">
              <FileCheck2 className="size-5 text-gold" />
              {t('sell.keepTitle')}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t('sell.keepBody')}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="flex items-center gap-2 font-subhead text-lg font-bold">
              <Coins className="size-5 text-gold" />
              {t('sell.frozenTitle')}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t('sell.frozenBody')}
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <Headline lead={t('sell.whatWeNeedTitle')} bold={t('catalogue.clearance')} size="lg" />
        <ul className="mt-8 max-w-[62ch] space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <li
              key={n}
              className="relative ps-6 font-serif leading-[1.9] text-foreground/85 before:absolute before:start-0 before:top-[0.85em] before:size-1.5 before:rounded-full before:bg-gold"
            >
              {t(`sell.whatWeNeed${n}`)}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/content-policy" className="text-gold underline underline-offset-4">
            {t('footer.contentPolicy')}
          </Link>
        </p>
      </Section>

      <Section tone="raised">
        <FaqSchema pairs={faqs} />
        <Headline lead={t('sell.faqTitle')} bold={t('nav.help')} size="lg" />
        <dl className="mt-8 max-w-[62ch] space-y-6">
          {faqs.map((faq) => (
            <div key={faq.q}>
              <dt className="font-bold">{faq.q}</dt>
              <dd className="mt-2 font-serif leading-[1.9] text-muted-foreground">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="accent">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <Headline
            lead={t('sell.lead')}
            bold={t('sell.boldLead')}
            size="lg"
            className="max-w-xl"
          />
          <Button asChild variant="gold" size="lg">
            <Link href="/sign-up?role=creator">{t('sell.apply')}</Link>
          </Button>
        </div>
      </Section>
    </>
  )
}
