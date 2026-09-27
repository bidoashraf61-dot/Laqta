import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Link } from '@/components/ui/link'
import { ArticleBody } from '@/components/blog/article-body'
import { PostCard } from '@/components/blog/post-card'
import { getPublicPost, listPosts } from '@/lib/blog'
import { albumRefs, parseBody, plainText, readingMinutes } from '@/lib/blog-render'
import { getAlbumCardsByRef } from '@/lib/catalogue'
import { formatDate, t } from '@/lib/i18n'
import { BCP47, currentLocale, localeAlternates, localePath, ogLocale, pickLocalised } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'
import { absoluteMediaUrl, mediaUrl } from '@/lib/media'
import { siteOrigin } from '@/lib/site'
import { LOGO_PATH } from '@/lib/brand'

/** The body in the reader's language — the English body only when one was written. */
function bodyFor(post: { bodyAr: string; bodyEn: string }) {
  return currentLocale() === 'en' && post.bodyEn.trim() ? post.bodyEn : post.bodyAr
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  await requestLocale()
  const { slug } = await params
  const post = await getPublicPost(slug)
  if (!post) return { title: t('state.notFound') }
  const en = currentLocale() === 'en'
  const title = (en ? post.seoTitleEn : post.seoTitleAr) || pickLocalised(post.titleAr, post.titleEn) || post.titleAr
  const description =
    (en ? post.seoDescEn : post.seoDescAr) ||
    pickLocalised(post.excerptAr, post.excerptEn) ||
    plainText(parseBody(bodyFor(post))).slice(0, 155)
  const image = absoluteMediaUrl(post.coverKey)
  return {
    title,
    description,
    alternates: localeAlternates(`/blog/${slug}`),
    openGraph: {
      type: 'article',
      locale: ogLocale(),
      title,
      description,
      publishedTime: post.publishAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      ...(image ? { images: [image] } : {}),
    },
  }
}

/**
 * A blog article (DEV-43). Read mode: the title and a line of facts, the
 * cover, then the body on a comfortable measure with album embeds as real
 * album cards. Article JSON-LD in the page's language.
 */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  await requestLocale()
  const { slug } = await params
  const post = await getPublicPost(slug)
  if (!post) notFound()

  const blocks = parseBody(bodyFor(post))
  const [albums, more] = await Promise.all([
    getAlbumCardsByRef(albumRefs(blocks)),
    listPosts({ categorySlug: post.category?.slug }),
  ])
  const title = pickLocalised(post.titleAr, post.titleEn) ?? post.titleAr
  const cover = mediaUrl(post.coverKey)
  const related = more.posts.filter((other) => other.id !== post.id).slice(0, 2)
  const url = `${siteOrigin()}${localePath(currentLocale(), `/blog/${slug}`)}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: pickLocalised(post.excerptAr, post.excerptEn) || undefined,
    inLanguage: BCP47[currentLocale()],
    datePublished: post.publishAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: url,
    ...(absoluteMediaUrl(post.coverKey) ? { image: [absoluteMediaUrl(post.coverKey)] } : {}),
    author: { '@type': 'Organization', name: t('brand.name'), url: siteOrigin() },
    publisher: {
      '@type': 'Organization',
      name: t('brand.name'),
      logo: { '@type': 'ImageObject', url: `${siteOrigin()}${LOGO_PATH}` },
    },
  }

  return (
    <article className="container py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-[68ch]">
        <nav className="mb-6 text-sm text-muted-foreground" aria-label={t('catalogue.breadcrumb')}>
          <Link href="/blog" className="hover:text-foreground">
            {t('blog.title')}
          </Link>
          {post.category ? (
            <>
              {' / '}
              <a href={localePath(currentLocale(), `/blog/category/${post.category.slug}`)} className="hover:text-foreground">
                {pickLocalised(post.category.nameAr, post.category.nameEn)}
              </a>
            </>
          ) : null}
        </nav>

        <header className="space-y-4">
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.12] text-balance">{title}</h1>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {post.publishAt ? <time dateTime={post.publishAt.toISOString()}>{formatDate(post.publishAt)}</time> : null}
            <span>{t('blog.readingTime', { minutes: readingMinutes(blocks) })}</span>
          </p>
        </header>
      </div>

      {cover ? (
        <div className="dark mx-auto mt-10 aspect-video max-w-5xl overflow-hidden rounded-md bg-ink">
          <img src={cover} alt="" className="size-full object-cover" />
        </div>
      ) : null}

      <div className="mx-auto mt-10 max-w-[68ch]">
        <ArticleBody blocks={blocks} albums={albums} />
      </div>

      {related.length > 0 ? (
        <aside className="mx-auto mt-20 max-w-5xl border-t pt-10">
          <h2 className="mb-8 font-display text-2xl font-bold">{t('blog.more')}</h2>
          <div className="grid gap-x-10 gap-y-12 md:grid-cols-2">
            {related.map((other) => (
              <PostCard key={other.id} post={other} />
            ))}
          </div>
        </aside>
      ) : null}
    </article>
  )
}
