import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import { db } from '@/lib/db'
import { mediaCdnConfigured, mediaUrl } from '@/lib/media'
import { s3Client } from '@/lib/storage'

/**
 * Watermarked-preview downloads — "comps".
 *
 * A signed-in visitor can download a clip's watermarked 720p preview, or a
 * whole album's as one ZIP, to cut into their own timeline before buying. It
 * is the standard stock-library comp, and the reason it exists is the same
 * everywhere: an editor who has already placed the shot in the edit is most of
 * the way to buying it.
 *
 * ── What this must never do ─────────────────────────────────────────────────
 * Serve anything but `Clip.previewKey`. The editing proxy (`proxyKey`) is the
 * buyer's CLEAN copy and the master is the product; either leaking through a
 * free, unauthenticated-by-purchase route would give the album away. So the
 * key is only ever read from `previewKey`, and `servablePreviewKey()` refuses
 * it again if it points into a private prefix or equals the clip's proxy or
 * master — a mis-set column cannot turn this into a proxy download.
 *
 * ── Where the bytes come from ───────────────────────────────────────────────
 *   · "/"-rooted key  → a file under `public/` (dev seed stand-ins). Streamed
 *                       from disk with `Content-Disposition: attachment`.
 *   · bucket key      → the PUBLIC media bucket. With `S3_MEDIA_BUCKET` +
 *                       `AWS_REGION` a single clip is a 302 to an S3 presigned
 *                       GET carrying `response-content-disposition`; the ZIP
 *                       reads each object with `GetObject`. With only
 *                       `NEXT_PUBLIC_MEDIA_CDN_URL`, the server fetches the
 *                       CDN copy and streams it through with the disposition
 *                       header (CloudFront cannot be asked to rename a file).
 *   · neither         → not available; the control is not rendered.
 */

// ── Limits ────────────────────────────────────────────────────────────────

function envInt(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

/**
 * Per user. Clip comps are counted over a rolling hour, album ZIPs over a
 * rolling day. An album is at most seventy clips and the ZIP covers the whole
 * of it, so sixty single clips an hour is generous for real testing across
 * several albums, and slow enough that walking the catalogue one clip at a
 * time is a day's work for a watermarked 720p copy.
 */
export function compLimits() {
  return {
    clipsPerHour: envInt('PREVIEW_CLIPS_PER_HOUR', 60),
    zipsPerDay: envInt('PREVIEW_ZIPS_PER_DAY', 5),
  }
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// ── The key guard ─────────────────────────────────────────────────────────

const PRIVATE_PREFIXES = ['masters/', 'proxies/', 'albums/', 'documents/']

export class PreviewRefusedError extends Error {}

/**
 * The only key this feature may serve for a clip, or a throw.
 *
 * A "/"-rooted key is a file already public under `public/` — the dev seed
 * points proxy and preview at the same stand-in loop there, and serving it
 * leaks nothing a page does not already serve. Any bucket key must be a
 * public-media key that is neither the clip's proxy nor its master.
 */
export function servablePreviewKey(clip: {
  previewKey: string | null
  proxyKey?: string | null
  masterKey?: string | null
}): string {
  const key = clip.previewKey?.trim()
  if (!key) throw new PreviewRefusedError('clip has no preview')
  if (key.includes('..')) throw new PreviewRefusedError('traversal in preview key')

  if (key.startsWith('/')) {
    if (key.startsWith('//')) throw new PreviewRefusedError('protocol-relative preview key')
    return key
  }

  const bare = key.replace(/^https?:\/\/[^/]+\//i, '')
  if (PRIVATE_PREFIXES.some((prefix) => bare.startsWith(prefix))) {
    throw new PreviewRefusedError('preview key points into a private prefix')
  }
  if (key === clip.proxyKey?.trim() || key === clip.masterKey?.trim()) {
    throw new PreviewRefusedError('preview key equals the clip proxy or master')
  }
  return key
}

// ── Names ─────────────────────────────────────────────────────────────────

function extension(key: string) {
  const match = key.match(/\.([a-z0-9]{2,4})(?:\?.*)?$/i)
  return match ? match[1].toLowerCase() : 'mp4'
}

/** `alula-golden-hour-aerials_clip-07_laqta-preview.mp4` — position is 1-based. */
export function compFilename(albumSlug: string, position: number, key: string) {
  return `${albumSlug}_clip-${String(position).padStart(2, '0')}_laqta-preview.${extension(key)}`
}

export function compZipName(albumSlug: string) {
  return `${albumSlug}_laqta-previews.zip`
}

export function attachment(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

// ── Sources ───────────────────────────────────────────────────────────────

function mediaBucket() {
  return process.env.S3_MEDIA_BUCKET?.trim() || ''
}

function awsRegion() {
  return process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || ''
}

export function mediaBucketConfigured() {
  return Boolean(mediaBucket() && awsRegion())
}

/** A "/"-rooted key as an absolute path inside `public/`, or null. */
function publicFile(key: string): string | null {
  const root = join(process.cwd(), 'public')
  const path = normalize(join(root, key))
  return path.startsWith(root + sep) ? path : null
}

/**
 * Can this key be delivered right now? Decides whether the control renders —
 * a download button that ends on a 404 is worse than none.
 */
export function previewDeliverable(key: string | null | undefined): boolean {
  if (!key) return false
  if (key.startsWith('/')) {
    const path = publicFile(key)
    return Boolean(path && existsSync(path))
  }
  return mediaBucketConfigured() || Boolean(mediaCdnConfigured() && mediaUrl(key))
}

export type PreviewSource = {
  size: number
  open: () => Promise<AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>>
}

/** Size up front, bytes on demand — what the ZIP writer needs. */
export async function previewSource(key: string): Promise<PreviewSource | null> {
  if (key.startsWith('/')) {
    const path = publicFile(key)
    if (!path || !existsSync(path)) return null
    const { size } = statSync(path)
    return { size, open: async () => createReadStream(path) }
  }

  if (mediaBucketConfigured()) {
    const { HeadObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await s3Client()
    const Key = key.replace(/^\/+/, '')
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: mediaBucket(), Key }))
      return {
        size: Number(head.ContentLength ?? 0),
        open: async () => {
          const object = await client.send(new GetObjectCommand({ Bucket: mediaBucket(), Key }))
          if (!object.Body) throw new Error(`empty body for ${Key}`)
          return object.Body.transformToWebStream() as ReadableStream<Uint8Array>
        },
      }
    } catch {
      return null
    }
  }

  const url = mediaUrl(key)
  if (!url || !url.startsWith('http')) return null
  const head = await fetch(url, { method: 'HEAD' }).catch(() => null)
  const size = Number(head?.headers.get('content-length') ?? NaN)
  if (!head?.ok || !Number.isFinite(size)) return null
  return {
    size,
    open: async () => {
      const response = await fetch(url)
      if (!response.ok || !response.body) throw new Error(`CDN ${response.status} for ${key}`)
      return response.body
    },
  }
}

/** Presigned GET on the media bucket, named for download. S3 driver only. */
export async function presignedPreviewUrl(key: string, filename: string): Promise<string> {
  const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ])
  return getSignedUrl(
    await s3Client(),
    new GetObjectCommand({
      Bucket: mediaBucket(),
      Key: key.replace(/^\/+/, ''),
      ResponseContentDisposition: attachment(filename),
      ResponseContentType: 'video/mp4',
    }),
    { expiresIn: 300 },
  )
}

/** A Node stream or web stream as a web stream, for a `Response` body. */
export function toWebStream(
  source: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  if (source instanceof ReadableStream) return source
  return Readable.toWeb(Readable.from(source)) as unknown as ReadableStream<Uint8Array>
}

// ── Rate limit + log ──────────────────────────────────────────────────────

export type CompGrant =
  | { ok: true }
  | { ok: false; limit: number; windowS: number }

/**
 * Count, decide and log in one transaction, under a per-user advisory lock.
 *
 * Without the lock, two parallel requests at N−1 both count N−1 and both pass.
 * The row is written BEFORE any byte is served — the same order as
 * `/api/download` — so an interrupted download still counts: the limit is on
 * requests granted, not on files finished.
 */
export async function grantComp(input: {
  userId: string
  albumId: string
  clipId: string | null
  fileCount: number
  ip: string | null
  userAgent: string | null
}): Promise<CompGrant> {
  const zip = input.clipId === null
  const limits = compLimits()
  const limit = zip ? limits.zipsPerDay : limits.clipsPerHour
  const window = zip ? DAY : HOUR

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`comp:${input.userId}`}))`
    const used = await tx.compDownload.count({
      where: {
        userId: input.userId,
        isAlbumZip: zip,
        createdAt: { gte: new Date(Date.now() - window) },
      },
    })
    if (used >= limit) return { ok: false as const, limit, windowS: window / 1000 }

    await tx.compDownload.create({
      data: {
        userId: input.userId,
        albumId: input.albumId,
        clipId: input.clipId,
        isAlbumZip: zip,
        fileCount: input.fileCount,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    })
    return { ok: true as const }
  })
}

// ── Request helpers shared by the two routes ─────────────────────────────

/**
 * The page to come back to, if the caller named one. Same-origin paths only —
 * an open redirect on a download route is a phishing link with our domain on
 * it.
 */
export function safeBack(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  return value
}

export function withNotice(back: string, notice: 'limit' | 'unavailable') {
  const [path] = back.split(/[?#]/)
  return `${path}?comp=${notice}#comps`
}

export function requestMeta(headers: Headers) {
  return {
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: headers.get('user-agent'),
  }
}
