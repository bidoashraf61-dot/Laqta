import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { studioActor, refusal } from '@/lib/route-auth'
import { completeClipUpload, editableClip } from '@/lib/uploads'
import { ingestSoon } from '@/lib/ingest'
import { recordAudit } from '@/lib/audit'

type Params = { params: Promise<{ clipId: string }> }

/**
 * Finish a master upload. Body: `{ parts: [{ partNumber, etag }] }` (the S3
 * ETags; ignored on the local driver, which reads what it stored). The stored
 * size is measured, the clip moves to `uploaded`, and ingest is kicked off in
 * the background — this answers before ffmpeg starts.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { actor, response } = await studioActor()
  if (!actor) return response
  const { clipId } = await params

  let body: { parts?: unknown }
  try {
    body = await request.json()
  } catch {
    return refusal('bad_request')
  }
  const parts = Array.isArray(body.parts)
    ? body.parts
        .map((part) => ({
          partNumber: Number((part as { partNumber?: unknown }).partNumber),
          etag: String((part as { etag?: unknown }).etag ?? ''),
        }))
        .filter((part) => Number.isInteger(part.partNumber) && part.partNumber > 0)
    : []

  const result = await completeClipUpload(actor, clipId, parts)
  if ('error' in result) return refusal(result.error)

  ingestSoon()
  await recordAudit({ actorId: actor.id, action: 'clip.upload_complete', entity: 'Clip', entityId: clipId })
  const { clip } = await editableClip(actor, clipId)
  if (clip) revalidatePath(`/studio/albums/${clip.albumId}`)
  return NextResponse.json({ ok: true })
}
