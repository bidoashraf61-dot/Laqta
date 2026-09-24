'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { actionT } from '@/lib/locale-request'
import { ensureSample } from '@/lib/sample'

/**
 * Curation of the free sample album.
 *
 * Every action re-checks the admin, writes one `AuditLog` row, and revalidates
 * both this screen and the public surfaces the sample feeds. None of them
 * touches an order, an entitlement or a ledger: what a claimant owns is the
 * manifest frozen when they claimed, so curating here only changes what the
 * NEXT claimant gets.
 */

type Result = { ok: boolean; message?: string }

const PATH = '/admin/merchandising/sample'

function revalidateSample() {
  revalidatePath(PATH)
  revalidatePath('/sample')
  revalidatePath('/albums')
}

/** Title and description, both languages. */
export async function saveSampleDetails(
  _state: Result | null,
  formData: FormData,
): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const sample = await ensureSample()

  const titleAr = String(formData.get('titleAr') ?? '').trim()
  const titleEn = String(formData.get('titleEn') ?? '').trim()
  // A title is what the library card and the certificate print. Arabic is the
  // fallback for every reader, so it cannot be empty.
  if (!titleAr) return { ok: false, message: tr('dash.sampleTitleRequired') }

  const data = {
    titleAr,
    titleEn: titleEn || titleAr,
    descriptionAr: String(formData.get('descriptionAr') ?? '').trim() || null,
    descriptionEn: String(formData.get('descriptionEn') ?? '').trim() || null,
  }
  await db.album.update({ where: { id: sample.albumId }, data })

  await recordAudit({
    actorId: admin.id,
    action: 'sample.details',
    entity: 'SampleAlbum',
    entityId: sample.id,
    detail: data,
  })
  revalidateSample()
  return { ok: true, message: tr('dash.saved') }
}

/** Add a clip from a live album to the end of the sample. */
export async function addSampleClip(clipId: string): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const sample = await ensureSample()

  const clip = await db.clip.findUnique({
    where: { id: clipId },
    select: { id: true, album: { select: { status: true } } },
  })
  if (!clip || clip.album.status !== 'live') {
    return { ok: false, message: tr('dash.sampleClipNotLive') }
  }

  const last = await db.sampleClip.findFirst({
    where: { sampleId: sample.id },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  // Upsert on the unique pair: a double click adds the clip once.
  await db.sampleClip.upsert({
    where: { sampleId_clipId: { sampleId: sample.id, clipId } },
    update: {},
    create: { sampleId: sample.id, clipId, orderIndex: (last?.orderIndex ?? -1) + 1 },
  })

  await recordAudit({
    actorId: admin.id,
    action: 'sample.clip_add',
    entity: 'SampleAlbum',
    entityId: sample.id,
    detail: { clipId },
  })
  revalidateSample()
  return { ok: true, message: tr('actions.confirm') }
}

/** Take a clip out of the sample. Past claims keep it — their manifest is frozen. */
export async function removeSampleClip(clipId: string): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const sample = await ensureSample()

  await db.sampleClip.deleteMany({ where: { sampleId: sample.id, clipId } })
  const album = await db.album.findUnique({
    where: { id: sample.albumId },
    select: { coverClipId: true },
  })
  if (album?.coverClipId === clipId) {
    await db.album.update({ where: { id: sample.albumId }, data: { coverClipId: null } })
  }

  await recordAudit({
    actorId: admin.id,
    action: 'sample.clip_remove',
    entity: 'SampleAlbum',
    entityId: sample.id,
    detail: { clipId },
  })
  revalidateSample()
  return { ok: true, message: tr('actions.confirm') }
}

/**
 * Move a clip one place up or down.
 *
 * Rewrites every row's `orderIndex` as 0..n-1 in the new order, so gaps and
 * ties left by earlier adds and removes can never make two clips swap back.
 */
export async function moveSampleClip(clipId: string, direction: 'up' | 'down'): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const sample = await ensureSample()

  const rows = await db.sampleClip.findMany({
    where: { sampleId: sample.id },
    orderBy: [{ orderIndex: 'asc' }, { addedAt: 'asc' }],
    select: { id: true, clipId: true },
  })
  const from = rows.findIndex((row) => row.clipId === clipId)
  const to = direction === 'up' ? from - 1 : from + 1
  if (from === -1 || to < 0 || to >= rows.length) return { ok: true }

  const reordered = [...rows]
  ;[reordered[from], reordered[to]] = [reordered[to], reordered[from]]
  await db.$transaction(
    reordered.map((row, index) =>
      db.sampleClip.update({ where: { id: row.id }, data: { orderIndex: index } }),
    ),
  )

  await recordAudit({
    actorId: admin.id,
    action: 'sample.clip_move',
    entity: 'SampleAlbum',
    entityId: sample.id,
    detail: { clipId, direction, from, to },
  })
  revalidateSample()
  return { ok: true, message: tr('actions.confirm') }
}

/** Use one of the chosen clips' frames as the sample's cover. */
export async function setSampleCover(clipId: string): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const sample = await ensureSample()

  const chosen = await db.sampleClip.findUnique({
    where: { sampleId_clipId: { sampleId: sample.id, clipId } },
    select: { id: true },
  })
  if (!chosen) return { ok: false, message: tr('state.error') }

  await db.album.update({ where: { id: sample.albumId }, data: { coverClipId: clipId } })
  await recordAudit({
    actorId: admin.id,
    action: 'sample.cover',
    entity: 'SampleAlbum',
    entityId: sample.id,
    detail: { clipId },
  })
  revalidateSample()
  return { ok: true, message: tr('actions.confirm') }
}

/**
 * Publish or unpublish.
 *
 * Publishing needs at least one chosen clip in a live album — a published
 * sample with nothing in it would advertise a gift that cannot be claimed.
 * Unpublishing never touches anyone's library.
 */
export async function setSamplePublished(isPublished: boolean): Promise<Result> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const sample = await ensureSample()

  if (isPublished) {
    const offered = await db.sampleClip.count({
      where: { sampleId: sample.id, clip: { album: { status: 'live' } } },
    })
    if (offered === 0) return { ok: false, message: tr('dash.sampleNeedsClips') }
  }

  await db.sampleAlbum.update({
    where: { id: sample.id },
    data: { isPublished, ...(isPublished ? { publishedAt: new Date() } : {}) },
  })
  await recordAudit({
    actorId: admin.id,
    action: isPublished ? 'sample.publish' : 'sample.unpublish',
    entity: 'SampleAlbum',
    entityId: sample.id,
  })
  revalidateSample()
  return { ok: true, message: tr('actions.confirm') }
}
