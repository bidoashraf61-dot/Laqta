import { NextResponse, type NextRequest } from 'next/server'
import { studioActor, refusal } from '@/lib/route-auth'
import { partCountFor, partSizeFor, uploadingClip, writeLocalPart } from '@/lib/uploads'
import { storageDriver } from '@/lib/storage'

type Params = { params: Promise<{ clipId: string }> }

/**
 * LOCAL DRIVER ONLY — one part of a master, streamed to `.media/uploads/`.
 *
 * On the S3 driver a part never reaches this server (the browser PUTs to a
 * presigned URL), so this answers 404 there rather than becoming a way to
 * pipe gigabytes through the app.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  if (storageDriver() !== 'local') return refusal('not_found')

  const { actor, response } = await studioActor()
  if (!actor) return response
  const { clipId } = await params

  const { error, clip } = await uploadingClip(actor, clipId)
  if (error || !clip) return refusal(error ?? 'not_found')

  const declared = Number(clip.sizeBytes ?? 0)
  const n = Number(request.nextUrl.searchParams.get('n'))
  if (!Number.isInteger(n) || n < 1 || n > partCountFor(declared)) return refusal('bad_request')
  if (!request.body) return refusal('bad_request')

  const limit = partSizeFor(declared)
  if (Number(request.headers.get('content-length') ?? 0) > limit) return refusal('size')

  try {
    const { size, etag } = await writeLocalPart(clip.id, n, request.body, limit)
    return new NextResponse(null, { status: 200, headers: { ETag: etag, 'X-Part-Size': String(size) } })
  } catch (failure) {
    if ((failure as Error).message === 'part_too_large') return refusal('size')
    throw failure
  }
}
