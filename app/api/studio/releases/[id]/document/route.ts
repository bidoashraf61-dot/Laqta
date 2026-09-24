import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { studioActor, refusal } from '@/lib/route-auth'
import {
  attachReleaseDocument,
  detachReleaseDocument,
  maxDocumentBytes,
  signedDocumentUrl,
  viewableRelease,
} from '@/lib/uploads'
import { documentPath } from '@/lib/storage'
import { recordAudit } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

/**
 * A release's scanned document — private, always behind this route.
 *
 *   GET    open it: the creator who owns it, or an admin. S3 → a 302 to a URL
 *          that lives 60 seconds; local → the file streamed with
 *          `Cache-Control: private, no-store`. Never a public key.
 *   PUT    attach / replace (raw body; `X-Filename` header, URI-encoded).
 *          Owner only, and only while the release is not `verified`.
 *   DELETE remove it, same rule.
 *
 * Uploaded through the server rather than presigned straight to S3 because a
 * scan is small (≤ `UPLOAD_MAX_DOCUMENT_BYTES`, default 15 MB) and the type
 * must be checked from its bytes BEFORE it is stored — a presigned PUT stores
 * whatever arrives.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { actor, response } = await studioActor()
  if (!actor) return response
  const { id } = await params

  const release = await viewableRelease(actor, id)
  if (!release) return refusal('not_found')
  const filename = release.fileName ?? 'release'
  const mime = release.fileMime ?? 'application/octet-stream'

  if (actor.role === 'admin') {
    await recordAudit({ actorId: actor.id, action: 'release.document_view', entity: 'Release', entityId: id })
  }

  const signed = await signedDocumentUrl(release.fileKey, filename, mime)
  if (signed) {
    return NextResponse.redirect(signed, { status: 302, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const path = documentPath(release.fileKey)
  let size: number
  try {
    size = (await stat(path)).size
  } catch {
    return refusal('not_found')
  }
  return new NextResponse(Readable.toWeb(createReadStream(path)) as ReadableStream, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(size),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { actor, response } = await studioActor()
  if (!actor) return response
  const { id } = await params

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxDocumentBytes()) return refusal('size')

  // Read with a hard cap: Content-Length can be absent or a lie.
  const chunks: Uint8Array[] = []
  let total = 0
  if (request.body) {
    const reader = request.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > maxDocumentBytes()) {
        await reader.cancel()
        return refusal('size')
      }
      chunks.push(value)
    }
  }
  const bytes = Buffer.concat(chunks)

  let name = 'release'
  try {
    name = decodeURIComponent(request.headers.get('x-filename') ?? 'release')
  } catch {
    // A malformed header is a cosmetic problem, not a reason to refuse.
  }

  const result = await attachReleaseDocument(actor, id, { bytes, name })
  if ('error' in result) return refusal(result.error)

  await recordAudit({
    actorId: actor.id,
    action: 'release.document_attach',
    entity: 'Release',
    entityId: id,
    detail: { mime: result.mime, bytes: bytes.length },
  })
  revalidatePath('/studio/releases')
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { actor, response } = await studioActor()
  if (!actor) return response
  const { id } = await params

  const result = await detachReleaseDocument(actor, id)
  if ('error' in result) return refusal(result.error)

  await recordAudit({ actorId: actor.id, action: 'release.document_remove', entity: 'Release', entityId: id })
  revalidatePath('/studio/releases')
  return NextResponse.json({ ok: true })
}
