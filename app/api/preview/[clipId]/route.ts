import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  PreviewRefusedError,
  attachment,
  compFilename,
  grantComp,
  mediaBucketConfigured,
  presignedPreviewUrl,
  previewSource,
  requestMeta,
  safeBack,
  servablePreviewKey,
  toWebStream,
} from '@/lib/previews'
import { NOT_FOUND, fileHeaders, limited, unauthenticated, unavailable } from '../respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One clip's watermarked preview, as a download — a "comp".
 *
 * Signed-in only, live albums only, `Clip.previewKey` only. See
 * `lib/previews.ts` for the key guard, the sources and the limit, and
 * `specs/api/preview-download.md` for the contract.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ clipId: string }> }) {
  const { clipId } = await params
  const back = safeBack(request.nextUrl.searchParams.get('back'))

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return unauthenticated(request, back)

  const clip = await db.clip.findFirst({
    // A clip in a paused, delisted or unreviewed album answers exactly like a
    // clip that does not exist: nothing about it is public.
    where: { id: clipId, album: { status: 'live' } },
    select: {
      id: true,
      albumId: true,
      previewKey: true,
      // Selected ONLY so the guard can refuse a preview key that equals them.
      // Neither is ever served from this route.
      proxyKey: true,
      masterKey: true,
      album: {
        select: { slug: true, clips: { orderBy: { orderIndex: 'asc' }, select: { id: true } } },
      },
    },
  })
  if (!clip) return NOT_FOUND()

  let key: string
  try {
    key = servablePreviewKey(clip)
  } catch (error) {
    if (error instanceof PreviewRefusedError && clip.previewKey) {
      console.error(`[comp] refused clip ${clip.id}: ${error.message}`)
    }
    return unavailable(request, back)
  }

  const position = clip.album.clips.findIndex((row) => row.id === clip.id) + 1
  const filename = compFilename(clip.album.slug, position, key)
  const { ip, userAgent } = requestMeta(request.headers)

  // Availability is settled BEFORE the grant, so a missing file never spends
  // the visitor's allowance.
  const presign = !key.startsWith('/') && mediaBucketConfigured()
  const source = presign ? null : await previewSource(key)
  if (!presign && !source) return unavailable(request, back)

  const grant = await grantComp({ userId, albumId: clip.albumId, clipId: clip.id, fileCount: 1, ip, userAgent })
  if (!grant.ok) return limited(request, back, grant)

  if (presign) {
    return NextResponse.redirect(await presignedPreviewUrl(key, filename), 302)
  }

  return new Response(toWebStream(await source!.open()), {
    status: 200,
    headers: fileHeaders(attachment(filename), 'video/mp4', source!.size),
  })
}
