import { NextResponse, type NextRequest } from 'next/server'
import { studioActor, refusal } from '@/lib/route-auth'
import { partCountFor, partTargets, uploadingClip } from '@/lib/uploads'

type Params = { params: Promise<{ clipId: string }> }

/**
 * Where to PUT the next batch of parts. Body: `{ partNumbers: number[] }`
 * (at most 100 per call). S3 driver → presigned `UploadPart` URLs straight to
 * the masters bucket; local driver → this app's `/part` route.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { actor, response } = await studioActor()
  if (!actor) return response
  const { clipId } = await params

  const { error, clip } = await uploadingClip(actor, clipId)
  if (error || !clip) return refusal(error ?? 'not_found')

  let body: { partNumbers?: unknown }
  try {
    body = await request.json()
  } catch {
    return refusal('bad_request')
  }
  const max = partCountFor(Number(clip.sizeBytes ?? 0))
  const numbers = Array.isArray(body.partNumbers) ? body.partNumbers.map(Number) : []
  if (
    numbers.length === 0 ||
    numbers.length > 100 ||
    numbers.some((n) => !Number.isInteger(n) || n < 1 || n > max)
  ) {
    return refusal('bad_request')
  }

  return NextResponse.json({ targets: await partTargets(clip, numbers) })
}
