import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, extname, isAbsolute, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { db } from '@/lib/db'
import { documentPath, s3Client, serverSideEncryption, storageDriver } from '@/lib/storage'
import { MAX_ALBUM_CLIPS } from '@/lib/studio'

/**
 * Creator uploads — masters into the PRIVATE masters store, release scans into
 * its `documents/` prefix, and the generated preview/poster into the PUBLIC
 * media store.
 *
 * ── Two drivers, one protocol ───────────────────────────────────────────────
 * The browser always runs the same multipart protocol: start → sign parts →
 * PUT each part → complete. Only where a part's PUT lands differs:
 *
 *   · `s3`    (`S3_MASTERS_BUCKET` + `AWS_REGION`) — an S3 presigned
 *             `UploadPart` URL. The bytes go browser → S3 directly and never
 *             touch this server, which is the only way a multi-GB master is
 *             sane. Needs CORS on the masters bucket (docs/tech/media-aws.md).
 *   · `local` (nothing configured) — `/api/studio/uploads/<clip>/part?n=N`,
 *             streamed to `.media/uploads/<clip>/` and assembled into
 *             `MEDIA_MASTERS_DIR` (default `.media/masters`) on completion —
 *             the same folder `npm run media:previews` reads masters from.
 *             Outside `public/`, so nothing serves it. The studio labels this
 *             driver as development storage; it is not a production path.
 *
 * A part is idempotent (re-PUTting part N replaces it), so an interrupted
 * upload resumes by asking which parts already landed and sending the rest.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ── Limits ────────────────────────────────────────────────────────────────

function envBytes(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

const GiB = 1024 ** 3
const MiB = 1024 ** 2

/** Per master. A 4K ProRes HQ minute is ~6 GB; 20 GB covers a long take. */
export function maxClipBytes() {
  return envBytes('UPLOAD_MAX_CLIP_BYTES', 20 * GiB)
}

/** Per scan. A multi-page permit scanned at 300dpi fits well inside this. */
export function maxDocumentBytes() {
  return envBytes('UPLOAD_MAX_DOCUMENT_BYTES', 15 * MiB)
}

export const CLIP_EXTENSIONS = ['.mov', '.mp4'] as const
/** What a browser labels a .mov/.mp4 — or nothing, which Safari does for ProRes. */
const CLIP_MIME = new Set(['', 'video/quicktime', 'video/mp4', 'application/octet-stream'])
/** Codecs ingest accepts, by ffprobe name. Anything else fails with `codec`. */
export const ACCEPTED_CODECS = new Set(['h264', 'hevc', 'prores'])

/**
 * Part size: 16 MiB, grown so a file never needs more than 9,000 parts (S3
 * allows 10,000). Local parts use the same size; each part is one request
 * body, which is why `/api/studio` is outside the middleware matcher — Next
 * buffers a middleware-visible body at 10 MB.
 */
export function partSizeFor(sizeBytes: number) {
  const base = 16 * MiB
  return Math.max(base, Math.ceil(sizeBytes / 9000 / MiB) * MiB)
}

export function partCountFor(sizeBytes: number) {
  return Math.max(1, Math.ceil(sizeBytes / partSizeFor(sizeBytes)))
}

export type UploadRefusal =
  | 'not_found'
  | 'not_editable'
  | 'type'
  | 'size'
  | 'too_many'
  | 'forbidden'

/** Validate what the browser SAYS it will send. Storage re-checks what arrived. */
export function checkClipFile(name: string, type: string, sizeBytes: number): UploadRefusal | null {
  const ext = extname(name).toLowerCase()
  if (!(CLIP_EXTENSIONS as readonly string[]).includes(ext)) return 'type'
  if (!CLIP_MIME.has(type)) return 'type'
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxClipBytes()) return 'size'
  return null
}

// ── Authorisation ─────────────────────────────────────────────────────────

type Actor = { id: string; role: string; creatorId?: string | null }

export const EDITABLE_STATUSES = ['draft', 'changes_requested'] as const

/**
 * The album a clip upload / edit may touch: owned by this creator (an admin
 * may act on any), and still `draft` or `changes_requested`. An album in
 * review is frozen — the reviewer must see what was submitted — and a live
 * album's clips are what buyers own.
 */
export async function editableAlbum(actor: Actor, albumId: string) {
  const album = await db.album.findFirst({
    where: { id: albumId, ...(actor.role === 'admin' ? {} : { creatorId: actor.creatorId ?? '' }) },
    select: { id: true, slug: true, status: true, creatorId: true, coverClipId: true },
  })
  if (!album) return { error: 'not_found' as const, album: null }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(album.status)) {
    return { error: 'not_editable' as const, album }
  }
  return { error: null, album }
}

/** A clip via its album, same rules. */
export async function editableClip(actor: Actor, clipId: string) {
  const clip = await db.clip.findUnique({
    where: { id: clipId },
    select: {
      id: true,
      albumId: true,
      slug: true,
      masterKey: true,
      previewKey: true,
      thumbnailKeys: true,
      ingestStatus: true,
      uploadId: true,
      sizeBytes: true,
    },
  })
  if (!clip) return { error: 'not_found' as const, clip: null, album: null }
  const { error, album } = await editableAlbum(actor, clip.albumId)
  if (error) return { error, clip: null, album: null }
  return { error: null, clip, album: album! }
}

// ── Masters ───────────────────────────────────────────────────────────────

export function masterKeyFor(albumId: string, clipId: string, filename: string) {
  return `masters/${albumId}/${clipId}${extname(filename).toLowerCase()}`
}

function projectPath(configured: string) {
  return isAbsolute(configured) ? configured : join(process.cwd(), configured)
}

/** Where the local driver keeps masters — shared with `media:previews`. */
export function localMasterPath(key: string) {
  const root = projectPath(process.env.MEDIA_MASTERS_DIR?.trim() || '.media/masters')
  return join(root, key.replace(/\.\./g, '').replace(/^\/+/, ''))
}

function localPartsDir(clipId: string) {
  return join(process.cwd(), '.media', 'uploads', clipId.replace(/[^A-Za-z0-9_-]/g, ''))
}

function mastersBucket() {
  return process.env.S3_MASTERS_BUCKET?.trim() || ''
}

/** Begin a master upload. Returns the S3 upload id, or null on the local driver. */
export async function startMasterUpload(key: string, contentType: string) {
  if (storageDriver() === 'local') return null
  const { CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3')
  const out = await (await s3Client()).send(
    new CreateMultipartUploadCommand({
      Bucket: mastersBucket(),
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    }),
  )
  if (!out.UploadId) throw new Error('S3 returned no UploadId')
  return out.UploadId
}

export type PartTarget = { partNumber: number; url: string; method: 'PUT' }

/** Where to PUT each part — a presigned S3 URL or the local streaming route. */
export async function partTargets(
  clip: { id: string; masterKey: string | null; uploadId: string | null },
  partNumbers: number[],
): Promise<PartTarget[]> {
  if (storageDriver() === 'local' || !clip.uploadId) {
    return partNumbers.map((n) => ({
      partNumber: n,
      url: `/api/studio/uploads/${clip.id}/part?n=${n}`,
      method: 'PUT' as const,
    }))
  }
  const [{ UploadPartCommand }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ])
  const client = await s3Client()
  return Promise.all(
    partNumbers.map(async (n) => ({
      partNumber: n,
      method: 'PUT' as const,
      // An hour per part: a 64 MB part on a slow uplink is minutes, and a
      // stale URL is simply re-signed on the next batch.
      url: await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: mastersBucket(),
          Key: clip.masterKey!,
          UploadId: clip.uploadId!,
          PartNumber: n,
        }),
        { expiresIn: 3600 },
      ),
    })),
  )
}

export type UploadedPart = { partNumber: number; size: number; etag: string }

/** Which parts already landed — what makes an upload resumable. */
export async function uploadedParts(clip: {
  id: string
  masterKey: string | null
  uploadId: string | null
}): Promise<UploadedPart[]> {
  if (storageDriver() === 'local' || !clip.uploadId) {
    const dir = localPartsDir(clip.id)
    if (!existsSync(dir)) return []
    const names = (await readdir(dir)).filter((name) => /^part-\d+$/.test(name))
    const parts = await Promise.all(
      names.map(async (name) => {
        const n = Number(name.slice(5))
        const info = await stat(join(dir, name))
        return { partNumber: n, size: info.size, etag: `"local-${n}-${info.size}"` }
      }),
    )
    return parts.sort((a, b) => a.partNumber - b.partNumber)
  }
  const { ListPartsCommand } = await import('@aws-sdk/client-s3')
  const client = await s3Client()
  const parts: UploadedPart[] = []
  let marker: string | undefined
  for (;;) {
    const out = await client.send(
      new ListPartsCommand({
        Bucket: mastersBucket(),
        Key: clip.masterKey!,
        UploadId: clip.uploadId,
        PartNumberMarker: marker,
      }),
    )
    for (const part of out.Parts ?? []) {
      parts.push({ partNumber: part.PartNumber!, size: part.Size ?? 0, etag: part.ETag ?? '' })
    }
    if (!out.IsTruncated) break
    marker = out.NextPartNumberMarker
  }
  return parts
}

/** Local driver: stream one part's request body to disk. */
export async function writeLocalPart(clipId: string, partNumber: number, body: ReadableStream<Uint8Array>, limit: number) {
  const dir = localPartsDir(clipId)
  await mkdir(dir, { recursive: true })
  const target = join(dir, `part-${partNumber}`)
  const tmp = `${target}.${randomUUID()}.tmp`
  let size = 0
  const hash = createHash('md5')
  const source = Readable.fromWeb(body as import('node:stream/web').ReadableStream<Uint8Array>)
  source.on('data', (chunk: Buffer) => {
    size += chunk.length
    hash.update(chunk)
    // A part larger than the negotiated part size is not a part — refuse it
    // before it fills the disk.
    if (size > limit) source.destroy(new Error('part_too_large'))
  })
  try {
    await pipeline(source, createWriteStream(tmp))
  } catch (error) {
    await unlink(tmp).catch(() => {})
    throw error
  }
  const { rename } = await import('node:fs/promises')
  await rename(tmp, target)
  return { size, etag: `"${hash.digest('hex')}"` }
}

/**
 * Finish a master upload and return the bytes actually stored — read back
 * from storage, never taken from the browser.
 */
export async function completeMasterUpload(
  clip: { id: string; masterKey: string; uploadId: string | null },
  parts: { partNumber: number; etag: string }[],
): Promise<number> {
  if (storageDriver() === 'local' || !clip.uploadId) {
    const dir = localPartsDir(clip.id)
    const landed = await uploadedParts({ ...clip, uploadId: null })
    if (landed.length === 0) throw new Error('no_parts')
    // Parts must be 1..N with no gap, or the file would be silently corrupt.
    landed.forEach((part, index) => {
      if (part.partNumber !== index + 1) throw new Error('missing_part')
    })
    const target = localMasterPath(clip.masterKey)
    await mkdir(dirname(target), { recursive: true })
    const out = createWriteStream(target)
    for (const part of landed) {
      await pipeline(createReadStream(join(dir, `part-${part.partNumber}`)), out, { end: false })
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())))
    await rm(dir, { recursive: true, force: true })
    return (await stat(target)).size
  }

  const { CompleteMultipartUploadCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3')
  const client = await s3Client()
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: mastersBucket(),
      Key: clip.masterKey,
      UploadId: clip.uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
      },
    }),
  )
  const head = await client.send(new HeadObjectCommand({ Bucket: mastersBucket(), Key: clip.masterKey }))
  return Number(head.ContentLength ?? 0)
}

/** Remove a master (or an unfinished upload) — best effort, never throws. */
export async function removeMaster(clip: { id: string; masterKey: string | null; uploadId: string | null }) {
  try {
    await rm(localPartsDir(clip.id), { recursive: true, force: true })
    if (!clip.masterKey || clip.masterKey.startsWith('/')) return
    if (storageDriver() === 'local') {
      await rm(localMasterPath(clip.masterKey), { force: true })
      return
    }
    const { AbortMultipartUploadCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await s3Client()
    if (clip.uploadId) {
      await client
        .send(new AbortMultipartUploadCommand({ Bucket: mastersBucket(), Key: clip.masterKey, UploadId: clip.uploadId }))
        .catch(() => {})
    }
    await client.send(new DeleteObjectCommand({ Bucket: mastersBucket(), Key: clip.masterKey }))
  } catch (error) {
    console.warn(`[uploads] could not remove master for ${clip.id}:`, (error as Error).message)
  }
}

/**
 * A local file the ingest job can read the master from: the local path as-is,
 * or the S3 object downloaded to `.media/tmp/` (the caller removes it).
 */
export async function materialiseMaster(key: string): Promise<{ path: string; temporary: boolean } | null> {
  if (key.startsWith('/')) {
    const path = join(process.cwd(), 'public', key)
    return existsSync(path) ? { path, temporary: false } : null
  }
  const local = localMasterPath(key)
  if (existsSync(local)) return { path: local, temporary: false }
  if (storageDriver() === 'local') return null
  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const response = await (await s3Client()).send(new GetObjectCommand({ Bucket: mastersBucket(), Key: key }))
  const path = join(process.cwd(), '.media', 'tmp', `${randomUUID()}${extname(key)}`)
  await mkdir(dirname(path), { recursive: true })
  await pipeline(response.Body as Readable, createWriteStream(path))
  return { path, temporary: true }
}

// ── Public media (previews, posters) ──────────────────────────────────────

function mediaBucketConfig() {
  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || ''
  const bucket = process.env.S3_MEDIA_BUCKET?.trim() || ''
  return region && bucket ? bucket : null
}

/** Where the local driver publishes previews: under public/, gitignored. */
const LOCAL_PUBLIC_PREFIX = '/uploads/'

/**
 * Put a generated preview/poster where the site can show it, and return the
 * key to store on the clip:
 *   · the media bucket when `S3_MEDIA_BUCKET` + `AWS_REGION` are set → the
 *     bucket key (`previews/<slug>.mp4`), resolved by `mediaUrl()` via the CDN;
 *   · otherwise `public/uploads/<key>` → the "/"-rooted key `/uploads/<key>`,
 *     the same shape as every dev-seed preview. Watermarked, so public is fine.
 */
export async function publishPublicMedia(file: string, key: string, contentType: string): Promise<string> {
  const bucket = mediaBucketConfig()
  if (bucket) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    await (await s3Client()).send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(file),
        ContentLength: (await stat(file)).size,
        ContentType: contentType,
        CacheControl: 'public, max-age=86400',
      }),
    )
    return key
  }
  const target = join(process.cwd(), 'public', LOCAL_PUBLIC_PREFIX, key)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(file, target)
  return `${LOCAL_PUBLIC_PREFIX}${key}`
}

/** Best effort. Only ever touches keys this module published. */
export async function removePublicMedia(key: string | null | undefined) {
  if (!key) return
  try {
    if (key.startsWith(LOCAL_PUBLIC_PREFIX)) {
      await rm(join(process.cwd(), 'public', key.replace(/\.\./g, '')), { force: true })
      return
    }
    const bucket = mediaBucketConfig()
    if (!bucket || !/^(previews|posters)\//.test(key)) return
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    await (await s3Client()).send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    console.warn(`[uploads] could not remove ${key}:`, (error as Error).message)
  }
}

// ── Album totals ──────────────────────────────────────────────────────────

/**
 * `clipCount`, `totalRuntimeS` and `totalSizeBytes` from READY clips only — a
 * clip still uploading has no duration and is not yet part of the album. The
 * cover falls back to the first ready clip when unset or pointing at a clip
 * that is gone.
 */
export async function refreshAlbumTotals(albumId: string) {
  const [album, ready] = await Promise.all([
    db.album.findUnique({ where: { id: albumId }, select: { coverClipId: true } }),
    db.clip.findMany({
      where: { albumId, ingestStatus: 'ready' },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, durationS: true, sizeBytes: true },
    }),
  ])
  if (!album) return
  const coverValid = ready.some((clip) => clip.id === album.coverClipId)
  await db.album.update({
    where: { id: albumId },
    data: {
      clipCount: ready.length,
      totalRuntimeS: Math.round(ready.reduce((sum, clip) => sum + Number(clip.durationS), 0)),
      totalSizeBytes: ready.reduce((sum, clip) => sum + (clip.sizeBytes ?? BigInt(0)), BigInt(0)),
      ...(coverValid ? {} : { coverClipId: ready[0]?.id ?? null }),
    },
  })
}

/** Close the gaps in `orderIndex` (0..n-1) after a delete. */
export async function renumberClips(albumId: string) {
  const clips = await db.clip.findMany({
    where: { albumId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, orderIndex: true },
  })
  await db.$transaction(
    clips
      .map((clip, index) => ({ clip, index }))
      .filter(({ clip, index }) => clip.orderIndex !== index)
      .map(({ clip, index }) => db.clip.update({ where: { id: clip.id }, data: { orderIndex: index } })),
  )
}

/** Can one more clip be started on this album? Counts every clip, in flight or not. */
export async function roomForClip(albumId: string) {
  return (await db.clip.count({ where: { albumId } })) < MAX_ALBUM_CLIPS
}

// ── Release documents ─────────────────────────────────────────────────────

export const DOCUMENT_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
} as const
export type DocumentMime = keyof typeof DOCUMENT_TYPES

/**
 * The type is read from the file's own first bytes, never from its name or
 * the browser's `Content-Type`: a renamed .html saved as "permit.pdf" and
 * later opened inline by an admin is the attack this closes.
 */
export function sniffDocument(bytes: Uint8Array): DocumentMime | null {
  const b = bytes
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return 'application/pdf'
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (
    b.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => b[index] === value)
  ) {
    return 'image/png'
  }
  return null
}

export function documentKeyFor(releaseId: string, mime: DocumentMime) {
  return `documents/releases/${releaseId}/${randomUUID()}${DOCUMENT_TYPES[mime]}`
}

/** Store a scan privately: the masters bucket's `documents/` prefix, or `.documents/`. */
export async function putDocument(key: string, bytes: Uint8Array, mime: DocumentMime) {
  if (!key.startsWith('documents/')) throw new Error('document keys live under documents/')
  if (storageDriver() === 'local') {
    const target = documentPath(key)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
    return
  }
  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  await (await s3Client()).send(
    new PutObjectCommand({
      Bucket: mastersBucket(),
      Key: key,
      Body: bytes,
      ContentType: mime,
      ...serverSideEncryption(),
    }),
  )
}

export async function removeDocument(key: string | null | undefined) {
  if (!key || !key.startsWith('documents/')) return
  try {
    if (storageDriver() === 'local') {
      await rm(documentPath(key), { force: true })
      return
    }
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    await (await s3Client()).send(new DeleteObjectCommand({ Bucket: mastersBucket(), Key: key }))
  } catch (error) {
    console.warn(`[uploads] could not remove ${key}:`, (error as Error).message)
  }
}

/** Seconds a scan's signed URL lives. Opened by a person, right now. */
export const DOCUMENT_URL_TTL_SECONDS = 60

/**
 * A URL to open a scan for the next minute (S3), or null on the local driver —
 * where the route streams the file itself after the same access check.
 */
export async function signedDocumentUrl(key: string, filename: string, mime: string) {
  if (storageDriver() === 'local') return null
  const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ])
  return getSignedUrl(
    await s3Client(),
    new GetObjectCommand({
      Bucket: mastersBucket(),
      Key: key,
      ResponseContentType: mime,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    { expiresIn: DOCUMENT_URL_TTL_SECONDS },
  )
}

// ── The upload protocol, as functions the routes (and the gate) call ─────

export type StartedUpload = {
  clipId: string
  driver: 's3' | 'local'
  partSize: number
  partCount: number
}

/**
 * Start one master upload: validate, create the Clip row as `uploading`, and
 * open the multipart upload. Specs are zero until ffprobe fills them — the
 * page never shows them for a clip that is not `ready`.
 */
export async function startClipUpload(
  actor: Actor,
  input: { albumId: string; name: string; type: string; size: number },
): Promise<{ error: UploadRefusal } | StartedUpload> {
  const { error, album } = await editableAlbum(actor, input.albumId)
  if (error || !album) return { error: error ?? 'not_found' }
  const bad = checkClipFile(input.name, input.type, input.size)
  if (bad) return { error: bad }
  if (!(await roomForClip(album.id))) return { error: 'too_many' }

  const id = `c${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const masterKey = masterKeyFor(album.id, id, input.name)
  const uploadId = await startMasterUpload(masterKey, input.type)
  const last = await db.clip.aggregate({ where: { albumId: album.id }, _max: { orderIndex: true } })
  // The filename, minus its extension, until the creator names the clip.
  const stem = input.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'clip'

  await db.clip.create({
    data: {
      id,
      albumId: album.id,
      slug: `${album.slug}-${id.slice(1, 11)}`,
      orderIndex: (last._max.orderIndex ?? -1) + 1,
      titleAr: stem,
      titleEn: stem,
      durationS: 0,
      width: 0,
      height: 0,
      fps: 0,
      masterKey,
      uploadId,
      // The DECLARED size, used only to re-derive the part size on resume;
      // replaced by the stored size on completion.
      sizeBytes: BigInt(input.size),
      originalFilename: input.name.slice(0, 255),
      ingestStatus: 'uploading',
    },
  })

  return {
    clipId: id,
    driver: uploadId ? 's3' : 'local',
    partSize: partSizeFor(input.size),
    partCount: partCountFor(input.size),
  }
}

/** The clip, only while its master is still arriving. */
export async function uploadingClip(actor: Actor, clipId: string) {
  const { error, clip } = await editableClip(actor, clipId)
  if (error || !clip) return { error: error ?? ('not_found' as const), clip: null }
  if (clip.ingestStatus !== 'uploading' || !clip.masterKey) {
    return { error: 'not_editable' as const, clip: null }
  }
  return { error: null, clip: { ...clip, masterKey: clip.masterKey } }
}

/**
 * Finish: assemble / complete, measure what is really stored, and queue the
 * clip for ingest. A stored size over the cap (a client that lied at start)
 * deletes the object and fails the clip with `size`.
 */
export async function completeClipUpload(
  actor: Actor,
  clipId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<{ error: UploadRefusal | 'incomplete' } | { ok: true }> {
  const { error, clip } = await uploadingClip(actor, clipId)
  if (error || !clip) return { error: error ?? 'not_found' }

  let size: number
  try {
    size = await completeMasterUpload(clip, parts)
  } catch (failure) {
    console.warn(`[uploads] complete failed for ${clipId}:`, (failure as Error).message)
    return { error: 'incomplete' }
  }

  if (size > maxClipBytes()) {
    await removeMaster({ ...clip, uploadId: null })
    await db.clip.update({
      where: { id: clip.id },
      data: { ingestStatus: 'failed', ingestError: 'size', uploadId: null },
    })
    return { error: 'size' }
  }

  await db.clip.update({
    where: { id: clip.id },
    data: { ingestStatus: 'uploaded', uploadId: null, sizeBytes: BigInt(size) },
  })
  return { ok: true }
}

// ── Release scans ─────────────────────────────────────────────────────────

/** A scan may be attached, replaced or removed only by its creator, and only until verified. */
async function ownRelease(actor: Actor, releaseId: string) {
  if (!actor.creatorId) return { error: 'forbidden' as const, release: null }
  const release = await db.release.findFirst({
    where: { id: releaseId, creatorId: actor.creatorId },
    select: { id: true, fileKey: true, verification: true, fileUploadedAt: true },
  })
  if (!release) return { error: 'not_found' as const, release: null }
  // A verified release is the record a reviewer signed off on. Swapping the
  // paper under a green badge would make the verification a lie.
  if (release.verification === 'verified') return { error: 'verified' as const, release: null }
  return { error: null, release }
}

export function hasDocument(release: { fileUploadedAt: Date | null; fileKey: string }) {
  return Boolean(release.fileUploadedAt) && release.fileKey.startsWith('documents/')
}

/**
 * Attach (or replace) a release's scan. The type comes from the bytes; the
 * name is kept only for the download filename. Replacing a REJECTED release's
 * scan puts it back to `pending` — a new document is a new thing to review,
 * and the old rejection reason no longer describes it.
 */
export async function attachReleaseDocument(
  actor: Actor,
  releaseId: string,
  file: { bytes: Uint8Array; name: string },
): Promise<{ error: UploadRefusal | 'verified' } | { ok: true; mime: DocumentMime }> {
  const { error, release } = await ownRelease(actor, releaseId)
  if (error || !release) return { error: error ?? 'not_found' }
  if (file.bytes.length === 0 || file.bytes.length > maxDocumentBytes()) return { error: 'size' }
  const mime = sniffDocument(file.bytes)
  if (!mime) return { error: 'type' }

  const key = documentKeyFor(release.id, mime)
  await putDocument(key, file.bytes, mime)
  await db.release.update({
    where: { id: release.id },
    data: {
      fileKey: key,
      fileName: file.name.replace(/[\r\n"\\/]/g, '').slice(0, 160) || `release${DOCUMENT_TYPES[mime]}`,
      fileMime: mime,
      fileSizeBytes: file.bytes.length,
      fileUploadedAt: new Date(),
      ...(release.verification === 'rejected' ? { verification: 'pending', rejectionReason: null } : {}),
    },
  })
  if (hasDocument(release)) await removeDocument(release.fileKey)
  return { ok: true, mime }
}

/** Remove the scan; the release itself (and its clip links) stays. */
export async function detachReleaseDocument(
  actor: Actor,
  releaseId: string,
): Promise<{ error: UploadRefusal | 'verified' } | { ok: true }> {
  const { error, release } = await ownRelease(actor, releaseId)
  if (error || !release) return { error: error ?? 'not_found' }
  if (!hasDocument(release)) return { ok: true }
  await db.release.update({
    where: { id: release.id },
    data: {
      fileKey: `pending/${actor.creatorId}`,
      fileName: null,
      fileMime: null,
      fileSizeBytes: null,
      fileUploadedAt: null,
    },
  })
  await removeDocument(release.fileKey)
  return { ok: true }
}

/** Who may OPEN a scan: its creator, or any admin. */
export async function viewableRelease(actor: Actor, releaseId: string) {
  const release = await db.release.findFirst({
    where: { id: releaseId, ...(actor.role === 'admin' ? {} : { creatorId: actor.creatorId ?? '' }) },
    select: { id: true, fileKey: true, fileName: true, fileMime: true, fileUploadedAt: true },
  })
  if (!release || !hasDocument(release)) return null
  return release
}

// ── Deleting a clip ───────────────────────────────────────────────────────

/**
 * Delete a clip: the row (its release links and board pins cascade), then its
 * master, preview and poster — storage best-effort, so a missing object never
 * strands a row the creator cannot get rid of.
 *
 * Refused once the album has ever been sold. Entitlement is served from the
 * frozen `clipManifestSnapshot`, which holds this clip's master KEY — deleting
 * the object would break a download someone paid for, whatever the album's
 * status is today.
 */
export async function destroyClip(clip: {
  id: string
  albumId: string
  masterKey: string | null
  uploadId: string | null
  previewKey: string | null
  thumbnailKeys: string[]
}): Promise<'ok' | 'sold'> {
  const sold = await db.orderItem.count({ where: { albumId: clip.albumId } })
  if (sold > 0) return 'sold'

  await db.clip.delete({ where: { id: clip.id } })
  await Promise.all([
    removeMaster(clip),
    removePublicMedia(clip.previewKey),
    ...clip.thumbnailKeys.map((key) => removePublicMedia(key)),
  ])
  await renumberClips(clip.albumId)
  await refreshAlbumTotals(clip.albumId)
  return 'ok'
}
