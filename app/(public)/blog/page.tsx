import type { Metadata } from 'next'
import { BlogIndex } from '@/components/blog/blog-index'
import { t } from '@/lib/i18n'
import { localeAlternates, ogLocale } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'
import { siteOrigin } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale()
  return {
    title: t('blog.title'),
    description: t('brand.seo.blog'),
    alternates: {
      ...localeAlternates('/blog'),
      types: { 'application/rss+xml': `${siteOrigin()}/blog/rss.xml${locale === 'en' ? '?lang=en' : ''}` },
    },
    openGraph: { type: 'website', locale: ogLocale(), title: t('blog.title'), description: t('brand.seo.blog') },
  }
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requestLocale()
  const { page } = await searchParams
  return <BlogIndex page={Math.max(1, Number(page) || 1)} />
}
