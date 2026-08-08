import { db } from '@/lib/db'

export type AlbumReviewData = {
  id: string
  rating: number
  bodyAr: string | null
  authorNameAr: string
  createdAt: Date
}

/**
 * Published reviews for an album, newest first.
 *
 * Hidden reviews never leave the database layer — a moderated review is
 * invisible to the public but must stay recoverable, because a deleted review
 * is an argument with a customer you cannot reconstruct.
 */
export async function getAlbumReviews(albumId: string, take = 20): Promise<AlbumReviewData[]> {
  const rows = await db.albumReview.findMany({
    where: { albumId, status: 'published' },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      rating: true,
      bodyAr: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    bodyAr: row.bodyAr,
    // Falling back to a generic label rather than an email: a reviewer's
    // address is not theirs to publish just because they left a star.
    authorNameAr: row.user.name?.trim() || 'مشترٍ موثّق',
    createdAt: row.createdAt,
  }))
}

/**
 * Recompute an album's rating from its published reviews.
 *
 * Written back to `Album.ratingAvg` / `ratingCount` rather than aggregated on
 * every read: the album page is the most-visited route in the catalogue and
 * this figure changes a few times a month.
 *
 * The count is stored alongside the average deliberately. An average without
 * its sample size is not a rating, it is a rumour — "5.0" from one buyer must
 * not outrank "4.6" from ninety.
 */
export async function recomputeAlbumRating(albumId: string) {
  const agg = await db.albumReview.aggregate({
    where: { albumId, status: 'published' },
    _avg: { rating: true },
    _count: { rating: true },
  })

  await db.album.update({
    where: { id: albumId },
    data: {
      ratingAvg: agg._count.rating > 0 ? (agg._avg.rating ?? 0) : null,
      ratingCount: agg._count.rating,
    },
  })
}

/** Has this user bought this album? The gate on writing a review. */
export async function ownsAlbum(userId: string, albumId: string) {
  const entitlement = await db.entitlement.findFirst({
    where: { userId, albumId },
    select: { id: true },
  })
  return entitlement != null
}

/**
 * The viewer's own review, if they have left one.
 *
 * The form must open on the rating they actually gave. Defaulting a returning
 * reviewer's form to five stars invites them to overwrite their own four with
 * one careless submit — the control would be lying about current state.
 */
export async function getOwnReview(userId: string, albumId: string) {
  return db.albumReview.findUnique({
    where: { albumId_userId: { albumId, userId } },
    select: { rating: true, bodyAr: true },
  })
}
