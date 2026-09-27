'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { actionT } from '@/lib/locale-request'
import type { ActionResult } from '@/components/dashboard/form'

/**
 * Blog admin (DEV-44). A post is written in one form and saved as a draft,
 * published now, or scheduled for a date — `status` and `publishAt` together
 * decide when readers see it (lib/blog.ts#publicPostWhere).
 */

const SLUG = /^[a-z0-9][a-z0-9-]{1,79}$/
const text = (form: FormData, name: string, max: number) => String(form.get(name) ?? '').trim().slice(0, max)

function revalidateBlog(slug?: string) {
  revalidatePath('/admin/blog')
  revalidatePath('/blog', 'layout')
  revalidatePath('/en/blog', 'layout')
  if (slug) {
    revalidatePath(`/blog/${slug}`)
    revalidatePath(`/en/blog/${slug}`)
  }
}

/** A new, empty draft — then straight to its editor. */
export async function createPost(): Promise<ActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const post = await db.blogPost.create({
    data: { slug: `draft-${Date.now().toString(36)}`, titleAr: tr('dash.blogUntitled'), authorId: admin.id },
  })
  await recordAudit({ actorId: admin.id, action: 'blog.create', entity: 'BlogPost', entityId: post.id })
  redirect(`/admin/blog/${post.id}`)
}

export async function savePost(id: string, _state: ActionResult | null, form: FormData): Promise<ActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const existing = await db.blogPost.findUnique({ where: { id }, select: { id: true, slug: true, publishAt: true, status: true } })
  if (!existing) return { ok: false, message: tr('state.notFound') }

  const slug = text(form, 'slug', 80).toLowerCase()
  if (!SLUG.test(slug)) return { ok: false, message: tr('dash.blogSlugInvalid') }
  if (await db.blogPost.findFirst({ where: { slug, NOT: { id } }, select: { id: true } })) {
    return { ok: false, message: tr('dash.blogSlugTaken') }
  }
  const titleAr = text(form, 'titleAr', 200)
  if (!titleAr) return { ok: false, message: tr('dash.blogTitleRequired') }

  const intent = String(form.get('intent') ?? 'draft')
  const scheduleRaw = text(form, 'publishAt', 40)
  let status: 'draft' | 'scheduled' | 'published' = 'draft'
  let publishAt: Date | null = existing.publishAt
  if (intent === 'publish') {
    status = 'published'
    // Re-publishing keeps the original date; a first publish is now.
    publishAt = existing.status === 'published' && existing.publishAt ? existing.publishAt : new Date()
  } else if (intent === 'schedule') {
    // The input is Riyadh wall-clock time (the editor shows it that way);
    // read it as +03:00, not in whatever zone the server runs in.
    const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduleRaw) ? new Date(`${scheduleRaw}:00+03:00`) : new Date(scheduleRaw)
    if (!scheduleRaw || Number.isNaN(at.getTime())) return { ok: false, message: tr('dash.blogScheduleInvalid') }
    if (at.getTime() <= Date.now()) return { ok: false, message: tr('dash.blogSchedulePast') }
    status = 'scheduled'
    publishAt = at
  } else {
    status = 'draft'
  }
  const bodyAr = text(form, 'bodyAr', 60_000)
  if (status !== 'draft' && !bodyAr) return { ok: false, message: tr('dash.blogBodyRequired') }

  const categoryId = String(form.get('categoryId') ?? '') || null
  if (categoryId && !(await db.blogCategory.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
    return { ok: false, message: tr('state.notFound') }
  }

  const seoDescAr = text(form, 'seoDescAr', 400) || null
  const seoDescEn = text(form, 'seoDescEn', 400) || null
  if ((seoDescAr?.length ?? 0) > 160 || (seoDescEn?.length ?? 0) > 160) return { ok: false, message: tr('dash.hubDescTooLong') }

  await db.blogPost.update({
    where: { id },
    data: {
      slug,
      status,
      publishAt,
      categoryId,
      titleAr,
      titleEn: text(form, 'titleEn', 200),
      excerptAr: text(form, 'excerptAr', 400),
      excerptEn: text(form, 'excerptEn', 400),
      bodyAr,
      bodyEn: text(form, 'bodyEn', 60_000),
      coverKey: text(form, 'coverKey', 300) || null,
      seoTitleAr: text(form, 'seoTitleAr', 70) || null,
      seoTitleEn: text(form, 'seoTitleEn', 70) || null,
      seoDescAr,
      seoDescEn,
    },
  })
  await recordAudit({ actorId: admin.id, action: `blog.${status === 'draft' ? 'save' : status}`, entity: 'BlogPost', entityId: id, detail: { slug } })
  revalidateBlog(existing.slug)
  revalidateBlog(slug)
  return {
    ok: true,
    message: tr(status === 'published' ? 'dash.blogPublished' : status === 'scheduled' ? 'dash.blogScheduled' : 'dash.blogDraftSaved'),
  }
}

export async function deletePost(id: string): Promise<ActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const post = await db.blogPost.findUnique({ where: { id }, select: { slug: true } })
  if (!post) return { ok: false, message: tr('state.notFound') }
  await db.blogPost.delete({ where: { id } })
  await recordAudit({ actorId: admin.id, action: 'blog.delete', entity: 'BlogPost', entityId: id, detail: { slug: post.slug } })
  revalidateBlog(post.slug)
  redirect('/admin/blog')
}

export async function saveBlogCategory(_state: ActionResult | null, form: FormData): Promise<ActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const slug = text(form, 'slug', 60).toLowerCase()
  const nameAr = text(form, 'nameAr', 60)
  const nameEn = text(form, 'nameEn', 60)
  if (!SLUG.test(slug)) return { ok: false, message: tr('dash.blogSlugInvalid') }
  if (!nameAr || !nameEn) return { ok: false, message: tr('dash.termAr') }
  const category = await db.blogCategory.upsert({ where: { slug }, update: { nameAr, nameEn }, create: { slug, nameAr, nameEn } })
  await recordAudit({ actorId: admin.id, action: 'blog.category', entity: 'BlogCategory', entityId: category.id, detail: { slug } })
  revalidateBlog()
  return { ok: true, message: tr('dash.saved') }
}
