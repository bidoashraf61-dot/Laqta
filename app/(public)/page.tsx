import type { Metadata } from 'next'
import { HeroCinematic } from '@/components/landing/hero-cinematic'
import {
  BrowseTiles,
  CreatorCta,
  FeaturedAlbums,
  HowItWorks,
  NewThisWeek,
  TopCreators,
  TrustStrip,
} from '@/components/landing/sections'
import { EmailCapture } from '@/components/landing/email-capture'
import { Clearance, OurStory, TheProblem, TheSolution, WhoItsFor } from '@/components/landing/positioning'
import {
  getCatalogueStats,
  getFeaturedAlbums,
  getNewAlbums,
  getTaxonomyTiles,
  getTopCreators,
} from '@/lib/catalogue'
import { t } from '@/lib/i18n'

const SITE_URL = process.env.AUTH_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
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
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    url: '/',
    title: `${t('brand.name')} — ${t('brand.tagline')}`,
    description: t('brand.promise'),
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
 * The landing page.
 *
 * Server-rendered end to end. Organic search is the cheapest acquisition
 * channel this business has, and the location hubs it links to are the main
 * differentiator against the global libraries — so nothing here may depend on
 * client JS to become visible.
 */
export default async function HomePage() {
  const [stats, featured, fresh, locations, categories, creators] = await Promise.all([
    getCatalogueStats(),
    getFeaturedAlbums(8),
    getNewAlbums(4),
    getTaxonomyTiles('location', 8),
    getTaxonomyTiles('category', 8),
    getTopCreators(6),
  ])

  return (
    <>
      <StructuredData />
      <HeroCinematic />
      <TrustStrip stats={stats} />
      {/* The story arc, before the catalogue: who we are, why the library they
          already pay for is not enough, and the solution — then who it is for. */}
      <OurStory />
      <TheProblem />
      <TheSolution />
      <FeaturedAlbums albums={featured} />
      <WhoItsFor />
      <BrowseTiles
        title={t('landing.locationsTitle')}
        subtitle={t('landing.locationsSubtitle')}
        base="/locations"
        tiles={locations}
      />
      <BrowseTiles
        title={t('landing.categoriesTitle')}
        subtitle={t('landing.categoriesSubtitle')}
        base="/categories"
        tiles={categories}
      />
      <NewThisWeek albums={fresh} />
      <Clearance />
      <TopCreators creators={creators} />
      <HowItWorks />
      <CreatorCta />
      <EmailCapture />
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
