import { NextResponse } from 'next/server'
import { studioActor, refusal } from '@/lib/route-auth'
import { destroyClip, editableClip, partCountFor, partSizeFor, uploadedParts, uploadingClip } from '@/lib/uploads'
import { storageDriver } from '@/lib/storage'
import { recordAudit } from '@/lib/audit'

type Params = { params: Promise<{ clipId: string }> }

/**
 * Resume: which parts of an in-flight master already landed. The browser
 * re-selects the same file (name and size must match what it started with),
 * then sends only the missing parts.
 */
export async function GET(_request: Request, { params }: Params) {
  const { actor, response } = await studioActor()
  if (!actor) return response
  const { clipId } = await params

  const { error, clip } = await uploadingClip(actor, clipId)
  if (error || !clip) return refusal(error ?? 'not_found')
  const size = Number(clip.sizeBytes ?? 0)
  return NextResponse.json({
    clipId,
    driver: storageDriver(),
    parts: await uploadedParts(clip),
    ...(size ? { partSize: partSizeFor(size), partCount: partCountFor(size) } : {}),
  })
}

/** Cancel an upload, or delete a clip at any ingest state — album still editable. */
export async function DELETE(_request: Request, { params }: Params) {
  const { actor, response } = await studioActor()
  if (!actor) return response
  const { clipId } = await params

  const { error, clip } = await editableClip(actor, clipId)
  if (error || !clip) return refusal(error ?? 'not_found')
  const result = await destroyClip(clip)
  if (result !== 'ok') return refusal(result)

  await recordAudit({ actorId: actor.id, action: 'clip.delete', entity: 'Clip', entityId: clipId })
  return NextResponse.json({ ok: true })
}
