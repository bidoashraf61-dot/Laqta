'use server'

import { revalidatePath } from 'next/cache'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { submitForReview } from '@/lib/studio'
import { recordAudit } from '@/lib/audit'

/**
 * Submit an album for review.
 *
 * Ownership is re-checked here, not just in the page. A server action is
 * reachable by anyone who can guess its id — rendering the page is not the
 * authorisation boundary.
 */
export async function submitAlbum(albumId: string) {
  const user = await requireCreator()

  const album = await db.album.findFirst({
    where: { id: albumId, ...(user.role === 'admin' ? {} : { creatorId: user.creatorId ?? '' }) },
    select: { id: true, status: true },
  })
  if (!album) return { ok: false, reasons: ['studio.albumMissing'] }
  if (album.status !== 'draft' && album.status !== 'changes_requested') {
    return { ok: false, reasons: ['studio.inReview'] }
  }

  const result = await submitForReview(albumId)
  if (result.ok) {
    await recordAudit({
      actorId: user.id,
      action: 'album.submit',
      entity: 'Album',
      entityId: albumId,
    })
    revalidatePath(`/studio/albums/${albumId}`)
  }
  return result
}
