import { NextResponse, type NextRequest } from 'next/server'
import { studioActor, refusal } from '@/lib/route-auth'
import { startClipUpload } from '@/lib/uploads'
import { recordAudit } from '@/lib/audit'

/**
 * Start a master upload on a `draft` / `changes_requested` album the caller
 * owns. Body: `{ albumId, name, type, size }`. Answers the clip id, the
 * driver, and the part size the browser must cut the file into.
 */
export async function POST(request: NextRequest) {
  const { actor, response } = await studioActor()
  if (!actor) return response

  let body: { albumId?: unknown; name?: unknown; type?: unknown; size?: unknown }
  try {
    body = await request.json()
  } catch {
    return refusal('bad_request')
  }
  if (typeof body.albumId !== 'string' || typeof body.name !== 'string') return refusal('bad_request')

  const result = await startClipUpload(actor, {
    albumId: body.albumId,
    name: body.name,
    type: typeof body.type === 'string' ? body.type : '',
    size: Number(body.size),
  })
  if ('error' in result) return refusal(result.error)

  await recordAudit({
    actorId: actor.id,
    action: 'clip.upload_start',
    entity: 'Clip',
    entityId: result.clipId,
    detail: { albumId: body.albumId, size: Number(body.size) },
  })
  return NextResponse.json(result, { status: 201 })
}
