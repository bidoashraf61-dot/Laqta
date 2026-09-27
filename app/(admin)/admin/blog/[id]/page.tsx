import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { BackLink, DashboardHeader } from '@/components/dashboard/primitives'
import { ActionButton } from '@/components/dashboard/form'
import { BlogEditor } from '@/components/admin/blog-editor'
import { deletePost, savePost } from '../actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('dash.blogEdit') }
}

/** `YYYY-MM-DDTHH:mm` in Riyadh time — what a datetime-local input shows the operator. */
function riyadhLocal(date: Date | null) {
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** One post's editor (DEV-44). */
export default async function AdminBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requestLocale()
  await requireAdmin()
  const { id } = await params
  const [post, categories, albums] = await Promise.all([
    db.blogPost.findUnique({ where: { id } }),
    db.blogCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }], select: { id: true, nameAr: true } }),
    db.album.findMany({
      where: { status: 'live' },
      orderBy: { publishedAt: 'desc' },
      take: 200,
      select: { slug: true, titleAr: true, creator: { select: { handle: true } } },
    }),
  ])
  if (!post) notFound()

  return (
    <>
      <BackLink href="/admin/blog" label={t('dash.blogTitle')} />
      <DashboardHeader
        title={post.titleAr}
        description={t('dash.blogEditHint')}
        action={
          <div className="flex items-center gap-3">
            {post.status !== 'draft' ? (
              <a href={`/blog/${post.slug}`} target="_blank" rel="noopener" className="text-sm underline underline-offset-4">
                {t('dash.hubPageView')}
              </a>
            ) : null}
            <ActionButton
              action={deletePost.bind(null, post.id)}
              label={t('dash.blogDelete')}
              confirm={t('dash.blogDeleteConfirm')}
              variant="ghost"
            />
          </div>
        }
      />
      <BlogEditor
        action={savePost.bind(null, post.id)}
        categories={categories}
        albums={albums.map((album) => ({ ref: `${album.creator.handle}/${album.slug}`, titleAr: album.titleAr }))}
        post={{
          slug: post.slug,
          status: post.status,
          categoryId: post.categoryId,
          titleAr: post.titleAr,
          titleEn: post.titleEn,
          excerptAr: post.excerptAr,
          excerptEn: post.excerptEn,
          bodyAr: post.bodyAr,
          bodyEn: post.bodyEn,
          coverKey: post.coverKey ?? '',
          seoTitleAr: post.seoTitleAr ?? '',
          seoTitleEn: post.seoTitleEn ?? '',
          seoDescAr: post.seoDescAr ?? '',
          seoDescEn: post.seoDescEn ?? '',
          publishAtLocal: riyadhLocal(post.publishAt),
        }}
      />
    </>
  )
}
