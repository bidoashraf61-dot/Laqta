import type { Metadata } from 'next'
import { HeroCinematic } from '@/components/landing/hero-cinematic'
import { ProblemSolution } from '@/components/landing/problem-solution'
import { FootageWall } from '@/components/landing/footage-wall'
import { TheCollection } from '@/components/landing/collection'
import { LicensingRights } from '@/components/landing/licensing'
import { PricingValue } from '@/components/landing/pricing-value'
import { LandingFaq } from '@/components/landing/faq'
import { FinalCta } from '@/components/landing/final-cta'
import { HowItWorks } from '@/components/landing/sections'
import { RequestFootage } from '@/components/landing/request-footage'
import { getFeaturedAlbums, getFootageWall } from '@/lib/catalogue'
import { t } from '@/lib/i18n'
import { LOGO_PATH, LOGO_SIZE, SOCIAL } from '@/lib/brand'
import { requestLocale } from '@/lib/locale-request'
import { localeAlternates } from '@/lib/locale'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: `${t('brand.name')} — ${t('brand.tagline')}`,
    description: `${t('brand.promise')} ${t('landing.featuredSubtitle')}`,
    keywords: [
      'لقطات فيديو سعودية',
      'مكتبة لقطات سعودية',
      'فوتاج سعودي',
      'لقطات الرياض',
      'لقطات العلا',
      'لقطات الدرعية',
      'لقطات جدة',
      'تصوير جوي السعودية',
      'لقطات للحملات الإعلانية السعودية',
      'مواد فيديو للجهات الحكومية',
      'stock footage Saudi Arabia',
      'Saudi b-roll',
      'Arabic stock video',
    ],
    alternates: localeAlternates('/'),
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
      url: '/',
      title: `${t('brand.name')} — ${t('brand.tagline')}`,
      description: t('brand.seo.home'),
      images: [{ url: '/hero/06-alula.jpg', width: 1920, height: 1080, alt: t('brand.tagline') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('brand.name')} — ${t('brand.tagline')}`,
      description: t('brand.seo.home'),
      images: ['/hero/06-alula.jpg'],
    },
  }
}

/**
 * The landing page.
 *
 * Server-rendered end to end. Organic search is the cheapest acquisition
 * channel this business has, and the location hubs it links to are the main
 * differentiator against the global libraries — so nothing here may depend on
 * client JS to become visible.
 */
export default async function HomePage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  // A young catalogue is presented by depth, not breadth: the wall of frames
  // and the considered collection do the selling, and nothing on the page
  // counts albums, creators, or clips out loud. As the catalogue grows the
  // same two queries simply return more.
  const [albums, footage] = await Promise.all([getFeaturedAlbums(6), getFootageWall(12)])

  return (
    <>
      <StructuredData />
      <HeroCinematic />
      {/* Name the pain, then the shortcut; catch the eye with the wall of
          frames; make the considered album pitch; state the rights; teach the
          model; make the value case; clear objections; take custom requests;
          then the final buyer push.

          The creator invitation used to close this page. It addressed the
          wrong half of the market immediately after the other half had been
          persuaded, and competed with the buyer CTA directly above it — it
          lives at the foot of /creators now. */}
      <ProblemSolution />
      <FootageWall footage={footage} />
      <TheCollection albums={albums} />
      <LicensingRights />
      <HowItWorks />
      <PricingValue />
      <LandingFaq />
      <RequestFootage />
      <FinalCta />
    </>
  )
}

/**
 * JSON-LD. `SearchAction` is what lets Google render a search box directly in
 * the result for the brand query — worth more than any amount of meta tuning.
 */
function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: t('brand.name'),
        alternateName: 'Laqta',
        description: t('brand.promise'),
        inLanguage: 'ar-SA',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/footage?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: t('brand.name'),
        alternateName: 'Laqta',
        url: SITE_URL,
        slogan: t('brand.tagline'),
        // The two fields whose absence was the biggest GEO gap in the audit.
        // `sameAs` is what lets an engine bind "لقطة" to an actual entity
        // instead of treating it as a phrase; without a logo the knowledge
        // panel and rich results have nothing to show.
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}${LOGO_PATH}`,
          width: LOGO_SIZE,
          height: LOGO_SIZE,
        },
        sameAs: SOCIAL.map((s) => s.href),
        areaServed: ['SA', 'AE', 'EG', 'KW', 'QA', 'BH', 'OM'],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      // Structured data has to reach the crawler in the HTML, and this object
      // is entirely our own — no user input is interpolated into it.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
