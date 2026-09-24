import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  attachment,
  compFilename,
  compZipName,
  grantComp,
  previewSource,
  requestMeta,
  safeBack,
  servablePreviewKey,
} from '@/lib/previews'
import { ZipTooLargeError, zipSize, zipStream, type ZipEntry } from '@/lib/zip-stream'
import { NOT_FOUND, fileHeaders, limited, unauthenticated, unavailable } from '../../respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Seventy previews through a slow connection can take a while.
export const maxDuration = 300

/**
 * Every preview in a live album as one ZIP, streamed.
 *
 * The archive is written as it is sent (`lib/zip-stream.ts`): each preview is
 * opened only when the one before it has been written, so memory is one chunk
 * whether the album is thirty clips or seventy. Entry names match the single
 * clip download exactly, so a comp an editor already has is the same file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await params
  const back = safeBack(request.nextUrl.searchParams.get('back'))

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return unauthenticated(request, back)

  const album = await db.album.findFirst({
    where: { id: albumId, status: 'live' },
    select: {
      id: true,
      slug: true,
      clips: {
        orderBy: { orderIndex: 'asc' },
        // proxyKey / masterKey are read only for the guard — never served.
        select: { id: true, previewKey: true, proxyKey: true, masterKey: true },
      },
    },
  })
  if (!album) return NOT_FOUND()

  const entries: ZipEntry[] = []
  for (const [index, clip] of album.clips.entries()) {
    let key: string
    try {
      key = servablePreviewKey(clip)
    } catch {
      // No preview (or a refused one): the clip is simply not in the comp
      // pack. Its page still shows its poster.
      continue
    }
    const source = await previewSource(key)
    if (!source) continue
    entries.push({
      name: compFilename(album.slug, index + 1, key),
      size: source.size,
      open: source.open,
    })
  }
  if (entries.length === 0) return unavailable(request, back)

  let length: number
  try {
    length = zipSize(entries)
  } catch (error) {
    if (error instanceof ZipTooLargeError) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 })
    }
    throw error
  }

  const { ip, userAgent } = requestMeta(request.headers)
  const grant = await grantComp({
    userId,
    albumId: album.id,
    clipId: null,
    fileCount: entries.length,
    ip,
    userAgent,
  })
  if (!grant.ok) return limited(request, back, grant)

  return new Response(zipStream(entries), {
    status: 200,
    headers: fileHeaders(attachment(compZipName(album.slug)), 'application/zip', length),
  })
}
