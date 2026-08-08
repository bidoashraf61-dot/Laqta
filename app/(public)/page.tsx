import type { Metadata } from 'next'
import { HeroCinematic } from '@/components/landing/hero-cinematic'
import { FootageWall } from '@/components/landing/footage-wall'
import { TheCollection } from '@/components/landing/collection'
import { LicensingRights } from '@/components/landing/licensing'
import { LandingFaq } from '@/components/landing/faq'
import { AlbumShelf, CreatorCta, HowItWorks, SpecialOffers } from '@/components/landing/sections'
import { EmailCapture } from '@/components/landing/email-capture'
import { getFeaturedAlbums, getFootageWall, getOfferAlbums } from '@/lib/catalogue'
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

/**
 * The landing page.
 *
 * Server-rendered end to end. Organic search is the cheapest acquisition
 * channel this business has, and the location hubs it links to are the main
 * differentiator against the global libraries — so nothing here may depend on
 * client JS to become visible.
 */
export default async function HomePage() {
  // A young catalogue is presented by depth, not breadth: the wall of frames
  // and the considered collection do the selling, and nothing on the page
  // counts albums, creators, or clips out loud. As the catalogue grows the
  // same two queries simply return more.
  const [albums, footage, offers, shelf] = await Promise.all([
    getFeaturedAlbums(6),
    getFootageWall(12),
    getOfferAlbums(4),
    getFeaturedAlbums(8),
  ])

  return (
    <>
      <StructuredData />
      <HeroCinematic />
      {/* Impulse-first: the reel catches, the wall floods the eye with Saudi
          frames (each a doorway into its album), then the collection makes the
          considered album pitch. Licensing lifts the last hesitation, how-it-
          works teaches the model, the FAQ clears the leftover objections. */}
      <FootageWall footage={footage} />
      <TheCollection albums={albums} />
      <SpecialOffers albums={offers} />
      <AlbumShelf albums={shelf} />
      <LicensingRights />
      <HowItWorks />
      <LandingFaq />
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
