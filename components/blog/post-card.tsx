import { Link } from '@/components/ui/link'
import { Bilingual } from '@/components/ui/bilingual'
import { formatDate } from '@/lib/i18n'
import { mediaUrl } from '@/lib/media'
import { pickLocalised } from '@/lib/locale'
import type { BlogListPost } from '@/lib/blog'

/**
 * One post in the blog list (DEV-43): the cover in the film's 16:9 frame when
 * there is one, then category and date, the title, the excerpt. The title is
 * the link; the whole card is not a button.
 */
export function PostCard({ post, lead = false }: { post: BlogListPost; lead?: boolean }) {
  const cover = mediaUrl(post.coverKey)
  const title = pickLocalised(post.titleAr, post.titleEn) ?? post.titleAr
  return (
    <article className={lead ? 'grid gap-6 md:grid-cols-[3fr_2fr] md:items-end' : 'space-y-3'}>
      {cover ? (
        <div className="dark aspect-video overflow-hidden rounded-md bg-ink">
          <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {post.category ? <Bilingual ar={post.category.nameAr} en={post.category.nameEn} /> : null}
          {post.publishAt ? <time dateTime={post.publishAt.toISOString()}>{formatDate(post.publishAt)}</time> : null}
        </p>
        <h2 className={lead ? 'font-display text-3xl font-bold leading-tight' : 'font-display text-xl font-bold leading-snug'}>
          <Link href={`/blog/${post.slug}`} className="hover:underline hover:underline-offset-4">
            {title}
          </Link>
        </h2>
        {pickLocalised(post.excerptAr, post.excerptEn) ? (
          <p className="font-serif leading-[1.85] text-foreground/75">{pickLocalised(post.excerptAr, post.excerptEn)}</p>
        ) : null}
      </div>
    </article>
  )
}
