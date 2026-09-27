import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Blog queries (DEV-43). A post is public when it is `published` or
 * `scheduled`, and its `publishAt` has passed — so a scheduled post appears on
 * its own at the set time, with no job to flip it.
 */
export function publicPostWhere(now = new Date()): Prisma.BlogPostWhereInput {
  return { status: { in: ['published', 'scheduled'] }, publishAt: { lte: now } }
}

export const BLOG_PAGE_SIZE = 12

const LIST_SELECT = {
  id: true,
  slug: true,
  titleAr: true,
  titleEn: true,
  excerptAr: true,
  excerptEn: true,
  coverKey: true,
  publishAt: true,
  category: { select: { slug: true, nameAr: true, nameEn: true } },
} as const

export async function listPosts({ categorySlug, page = 1 }: { categorySlug?: string; page?: number }) {
  const where: Prisma.BlogPostWhereInput = {
    ...publicPostWhere(),
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
  }
  const [posts, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      orderBy: { publishAt: 'desc' },
      skip: (Math.max(1, page) - 1) * BLOG_PAGE_SIZE,
      take: BLOG_PAGE_SIZE,
      select: LIST_SELECT,
    }),
    db.blogPost.count({ where }),
  ])
  return { posts, total, pages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)) }
}

export type BlogListPost = Awaited<ReturnType<typeof listPosts>>['posts'][number]

/** Categories that hold at least one public post — an empty one is not a page. */
export async function blogCategories() {
  return db.blogCategory.findMany({
    where: { posts: { some: publicPostWhere() } },
    orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    select: { slug: true, nameAr: true, nameEn: true },
  })
}

export async function getPublicPost(slug: string) {
  return db.blogPost.findFirst({
    where: { slug, ...publicPostWhere() },
    include: { category: { select: { slug: true, nameAr: true, nameEn: true } }, author: { select: { name: true } } },
  })
}

/** The latest public posts, for the feed and the sitemap. */
export async function latestPosts(take = 50) {
  return db.blogPost.findMany({ where: publicPostWhere(), orderBy: { publishAt: 'desc' }, take, select: { ...LIST_SELECT, updatedAt: true } })
}
