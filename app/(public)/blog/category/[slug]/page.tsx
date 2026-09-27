import type { Metadata } from 'next'
import { BlogIndex } from '@/components/blog/blog-index'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'
import { localeAlternates, ogLocale, pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  await requestLocale()
  const { slug } = await params
  const category = await db.blogCategory.findUnique({ where: { slug } })
  if (!category) return { title: t('state.notFound') }
  const name = pickLocalised(category.nameAr, category.nameEn) ?? category.nameAr
  const title = t('blog.categoryTitle', { name })
  return {
    title,
    description: t('brand.seo.blogCategory', { name }),
    alternates: localeAlternates(`/blog/category/${slug}`),
    openGraph: { type: 'website', locale: ogLocale(), title },
  }
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  await requestLocale()
  const { slug } = await params
  const { page } = await searchParams
  return <BlogIndex categorySlug={slug} page={Math.max(1, Number(page) || 1)} />
}
