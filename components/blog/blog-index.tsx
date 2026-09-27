import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/ui/state'
import { Headline } from '@/components/ui/typography'
import { PostCard } from '@/components/blog/post-card'
import { blogCategories, listPosts } from '@/lib/blog'
import { formatNumber, t } from '@/lib/i18n'
import { currentLocale, localePath, pickLocalised } from '@/lib/locale'
import { cn } from '@/lib/utils'

/**
 * The blog list (DEV-43) — `/blog` and `/blog/category/[slug]`. The newest
 * post leads, wide; the rest follow in two columns. Category chips and the
 * pager are plain anchors: filters on this codebase's client router have
 * been swallowed before (CLAUDE.md), and each is a real, indexable URL.
 */
export async function BlogIndex({ categorySlug, page }: { categorySlug?: string; page: number }) {
  const [{ posts, total, pages }, categories] = await Promise.all([listPosts({ categorySlug, page }), blogCategories()])
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null
  if (categorySlug && !category) notFound()

  const locale = currentLocale()
  const here = categorySlug ? `/blog/category/${categorySlug}` : '/blog'
  const href = (path: string) => localePath(locale, path)
  const [lead, ...rest] = page === 1 ? posts : [undefined, ...posts]

  return (
    <div className="container py-16">
      <header className="mb-10 max-w-2xl space-y-4">
        <Headline
          as="h1"
          lead={t('blog.lead')}
          bold={category ? (pickLocalised(category.nameAr, category.nameEn) ?? category.nameAr) : t('blog.bold')}
          size="lg"
        />
        <p className="font-serif text-lg leading-[1.85] text-foreground/75">{t('blog.intro')}</p>
      </header>

      {categories.length > 0 ? (
        <nav aria-label={t('blog.categories')} className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {[{ slug: '', nameAr: t('blog.all'), nameEn: t('blog.all') }, ...categories].map((c) => {
              const current = (c.slug || undefined) === categorySlug
              return (
                <li key={c.slug || 'all'}>
                  <a
                    href={href(c.slug ? `/blog/category/${c.slug}` : '/blog')}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors',
                      current ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40',
                    )}
                  >
                    {pickLocalised(c.nameAr, c.nameEn)}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      {total === 0 ? (
        <EmptyState title={t('blog.empty')} description={t('blog.emptyHint')} />
      ) : (
        <div className="space-y-14">
          {lead ? <PostCard post={lead} lead /> : null}
          {rest.length > 0 ? (
            <div className="grid gap-x-10 gap-y-12 md:grid-cols-2">
              {rest.filter(Boolean).map((post) => (
                <PostCard key={post!.id} post={post!} />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label={t('blog.pages')} className="mt-14 flex items-center justify-between text-sm">
          {page > 1 ? <a href={href(`${here}?page=${page - 1}`)} className="underline underline-offset-4">{t('blog.newer')}</a> : <span />}
          <span className="numeric text-muted-foreground">
            {formatNumber(page)} / {formatNumber(pages)}
          </span>
          {page < pages ? <a href={href(`${here}?page=${page + 1}`)} className="underline underline-offset-4">{t('blog.older')}</a> : <span />}
        </nav>
      ) : null}
    </div>
  )
}
