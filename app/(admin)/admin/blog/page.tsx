import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/state'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { UserText } from '@/components/ui/bilingual'
import { formatDate, t } from '@/lib/i18n'
import { requestLocale } from '@/lib/locale-request'
import { createPost, saveBlogCategory } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return { title: t('dash.blogTitle') }
}

/**
 * The blog's posts and categories (DEV-44). Each row opens its editor with a
 * plain anchor; «مقال جديد» makes a draft and goes straight to it.
 */
export default async function AdminBlogPage() {
  await requestLocale()
  await requireAdmin()
  const now = new Date()
  const [posts, categories] = await Promise.all([
    db.blogPost.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      select: { id: true, slug: true, titleAr: true, status: true, publishAt: true, updatedAt: true, category: { select: { nameAr: true } } },
    }),
    db.blogCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }], include: { _count: { select: { posts: true } } } }),
  ])

  return (
    <>
      <DashboardHeader
        title={t('dash.blogTitle')}
        description={t('dash.blogHint')}
        action={<ActionButton action={createPost} label={t('dash.blogNew')} variant="gold" />}
      />

      {posts.length === 0 ? (
        <EmptyState title={t('dash.blogEmpty')} description={t('dash.blogHint')} />
      ) : (
        <Panel className="mb-8 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dash.blogColTitle')}</TableHead>
                <TableHead>{t('dash.blogCategory')}</TableHead>
                <TableHead>{t('dash.blogColStatus')}</TableHead>
                <TableHead>{t('dash.blogColUpdated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const live = post.status !== 'draft' && post.publishAt && post.publishAt <= now
                return (
                  <TableRow key={post.id}>
                    <TableCell>
                      <a href={`/admin/blog/${post.id}`} className="font-medium underline-offset-4 hover:underline">
                        <UserText>{post.titleAr}</UserText>
                      </a>
                      <span className="ltr-island block text-xs text-muted-foreground">/blog/{post.slug}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {post.category ? <UserText>{post.category.nameAr}</UserText> : '—'}
                    </TableCell>
                    <TableCell>
                      {post.status === 'draft' ? (
                        <Badge variant="neutral">{t('dash.blogStatusDraft')}</Badge>
                      ) : live ? (
                        <Badge variant="success">{t('dash.blogStatusLive')}</Badge>
                      ) : (
                        <Badge variant="warning">
                          {t('dash.blogStatusScheduled')} <span className="numeric ms-1">{post.publishAt ? formatDate(post.publishAt) : ''}</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="numeric text-xs text-muted-foreground">{formatDate(post.updatedAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Panel className="max-w-2xl space-y-4 p-5">
        <h2 className="font-bold">{t('dash.blogCategories')}</h2>
        {categories.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {categories.map((category) => (
              <li key={category.id} className="rounded-full border px-3 py-1">
                <UserText>{category.nameAr}</UserText>
                <span className="ltr-island ms-2 text-xs text-muted-foreground">{category.slug}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <SettingsForm action={saveBlogCategory} submitLabel={t('dash.blogCategoryAdd')}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('dash.blogCategoryNameAr')} htmlFor="cat-ar" required>
              <Input id="cat-ar" name="nameAr" maxLength={60} required />
            </Field>
            <Field label={t('dash.blogCategoryNameEn')} htmlFor="cat-en" required>
              <Input id="cat-en" name="nameEn" dir="ltr" maxLength={60} required />
            </Field>
            <Field label={t('dash.blogSlug')} htmlFor="cat-slug" required>
              <Input id="cat-slug" name="slug" dir="ltr" maxLength={60} required />
            </Field>
          </div>
        </SettingsForm>
      </Panel>
    </>
  )
}
