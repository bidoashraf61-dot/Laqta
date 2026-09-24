/**
 * Studio uploads — clip masters and release scans.
 *
 *   npm run verify:uploads                                         (DB on :5433, ffmpeg, Chrome)
 *   VERIFY_BASE_URL=http://localhost:3112 npm run verify:uploads   (+ HTTP checks)
 *
 * Drives the same functions the `/api/studio/*` routes call, on whichever
 * storage driver is configured (local in development), with fixtures it makes
 * and removes itself:
 *
 *   · a start is refused for another creator's album, an album in review,
 *     a wrong type, an oversized file, and a full album
 *   · a real master (generated here with ffmpeg) uploads in parts, and
 *     ffprobe — not the client — fills width/height/fps/duration/codec
 *   · ingest makes a watermarked preview and a poster, and the album's
 *     clipCount / runtime / size follow the READY clips
 *   · a release scan is sniffed by its bytes, lives under documents/, is
 *     refused by mediaUrl(), and is never under public/ (nor served there)
 *   · deleting a clip removes its row and its stored objects
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'
import { mediaUrl } from '@/lib/media'
import { documentPath, storageDriver } from '@/lib/storage'
import {
  attachReleaseDocument,
  completeClipUpload,
  destroyClip,
  detachReleaseDocument,
  localMasterPath,
  partTargets,
  sniffDocument,
  startClipUpload,
  uploadedParts,
  viewableRelease,
  writeLocalPart,
} from '@/lib/uploads'
import { processPending } from '@/lib/ingest'
import { canSubmit } from '@/lib/studio'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const TAG = `vu${process.pid}`
const workdir = join(process.cwd(), '.media', 'verify-uploads')

function ffmpeg(args: string[]) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])
  if (result.status !== 0) throw new Error(`ffmpeg: ${result.stderr?.toString()}`)
}

async function fixtures() {
  const band = await db.priceBand.findFirst({ select: { priceStandard: true, currency: true } })
  const make = async (suffix: string) => {
    const user = await db.user.create({
      data: { email: `${TAG}-${suffix}@verify.invalid`, name: `Verify ${suffix}`, role: 'creator' },
    })
    const creator = await db.creator.create({
      data: {
        userId: user.id,
        handle: `${TAG}-${suffix}`,
        displayNameAr: 'تحقق',
        displayNameEn: 'Verify',
        status: 'approved',
      },
    })
    return { id: user.id, role: 'creator', creatorId: creator.id }
  }
  const owner = await make('owner')
  const other = await make('other')
  const album = (status: 'draft' | 'in_review', slug: string) =>
    db.album.create({
      data: {
        slug: `${TAG}-${slug}`,
        creatorId: owner.creatorId,
        titleAr: 'ألبوم تحقق',
        titleEn: 'Verify album',
        status,
        priceStandard: band?.priceStandard ?? 100,
        currency: band?.currency ?? 'USD',
      },
      select: { id: true },
    })
  const draft = await album('draft', 'draft')
  const inReview = await album('in_review', 'review')
  return { owner, other, draft, inReview }
}

async function cleanup() {
  const creators = await db.creator.findMany({ where: { handle: { startsWith: TAG } }, select: { id: true, userId: true } })
  const clips = await db.clip.findMany({
    where: { album: { creatorId: { in: creators.map((c) => c.id) } } },
    select: { id: true, albumId: true, masterKey: true, uploadId: true, previewKey: true, thumbnailKeys: true },
  })
  for (const clip of clips) await destroyClip(clip).catch(() => {})
  await db.release.deleteMany({ where: { creatorId: { in: creators.map((c) => c.id) } } })
  await db.album.deleteMany({ where: { creatorId: { in: creators.map((c) => c.id) } } })
  await db.auditLog.deleteMany({ where: { actorId: { in: creators.map((c) => c.userId) } } }).catch(() => {})
  await db.creator.deleteMany({ where: { id: { in: creators.map((c) => c.id) } } })
  await db.user.deleteMany({ where: { id: { in: creators.map((c) => c.userId) } } })
  rmSync(workdir, { recursive: true, force: true })
}

/** PUT every part of `file` the way the browser does, on the local driver. */
async function sendParts(clipId: string, file: string, partSize: number, partCount: number) {
  const bytes = readFileSync(file)
  const clip = await db.clip.findUniqueOrThrow({ where: { id: clipId }, select: { id: true, masterKey: true, uploadId: true } })
  const targets = await partTargets(clip, Array.from({ length: partCount }, (_, i) => i + 1))
  const parts: { partNumber: number; etag: string }[] = []
  for (const target of targets) {
    const chunk = bytes.subarray((target.partNumber - 1) * partSize, target.partNumber * partSize)
    const body = new Blob([chunk]).stream()
    const { etag } = await writeLocalPart(clipId, target.partNumber, body, partSize)
    parts.push({ partNumber: target.partNumber, etag })
  }
  return parts
}

async function main() {
  console.log(`Studio uploads (storage driver: ${storageDriver()})\n`)
  if (storageDriver() !== 'local') {
    console.log('  note  S3 is configured — the part PUTs below need the local driver; run without S3_MASTERS_BUCKET.')
    process.exit(1)
  }
  await cleanup()
  const { owner, other, draft, inReview } = await fixtures()
  mkdirSync(workdir, { recursive: true })

  try {
    // ── Refusals ─────────────────────────────────────────────────────────
    const ok = { name: 'a.mov', type: 'video/quicktime', size: 10_000_000 }
    const notOwner = await startClipUpload(other, { albumId: draft.id, ...ok })
    check("another creator's album → not_found", 'error' in notOwner && notOwner.error === 'not_found')
    const frozen = await startClipUpload(owner, { albumId: inReview.id, ...ok })
    check('album in review → not_editable', 'error' in frozen && frozen.error === 'not_editable')
    const badType = await startClipUpload(owner, { albumId: draft.id, name: 'a.avi', type: 'video/x-msvideo', size: 10 })
    check('.avi → type', 'error' in badType && badType.error === 'type')
    const lying = await startClipUpload(owner, { albumId: draft.id, name: 'a.mov', type: 'text/html', size: 10 })
    check('.mov declared as text/html → type', 'error' in lying && lying.error === 'type')
    const huge = await startClipUpload(owner, { albumId: draft.id, name: 'a.mp4', type: 'video/mp4', size: 1e13 })
    check('10 TB → size', 'error' in huge && huge.error === 'size')
    const none = await db.clip.count({ where: { albumId: draft.id } })
    check('no refusal created a clip row', none === 0)

    // ── A real master, uploaded in parts ─────────────────────────────────
    const master = join(workdir, 'master.mp4')
    ffmpeg([
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25',
      '-t', '3',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      master,
    ])
    const size = statSync(master).size
    const started = await startClipUpload(owner, { albumId: draft.id, name: 'Dunes at dusk.mp4', type: 'video/mp4', size })
    if ('error' in started) throw new Error(`start refused: ${started.error}`)
    check('start → uploading clip row', (await db.clip.findUnique({ where: { id: started.clipId } }))?.ingestStatus === 'uploading')

    // Split into 3 parts regardless of the real part size, to exercise assembly.
    const partSize = Math.ceil(size / 3)
    const parts = await sendParts(started.clipId, master, partSize, 3)
    const landed = await uploadedParts({ id: started.clipId, masterKey: null, uploadId: null })
    check('resume sees every landed part', landed.length === 3)

    const forged = await completeClipUpload(other, started.clipId, parts)
    check("another creator cannot complete it", 'error' in forged && forged.error === 'not_found')
    const done = await completeClipUpload(owner, started.clipId, parts)
    check('complete → ok', 'ok' in done)
    const stored = await db.clip.findUniqueOrThrow({ where: { id: started.clipId } })
    check('stored size is what landed, byte for byte', Number(stored.sizeBytes) === size, `${stored.sizeBytes} vs ${size}`)
    check('master assembled outside public/', existsSync(localMasterPath(stored.masterKey!)) && !stored.masterKey!.startsWith('/'))
    check('clip queued as uploaded', stored.ingestStatus === 'uploaded')

    // ── Ingest: specs from ffprobe, preview + poster ─────────────────────
    const results = await processPending()
    const mine = results.find((r) => r.clipId === started.clipId)
    check('ingest ran → ready', mine?.result === 'ready', JSON.stringify(mine))
    const clip = await db.clip.findUniqueOrThrow({ where: { id: started.clipId } })
    check('width/height from the file', clip.width === 1280 && clip.height === 720, `${clip.width}×${clip.height}`)
    check('fps from the file', Number(clip.fps) === 25, String(clip.fps))
    check('duration from the file', Math.abs(Number(clip.durationS) - 3) < 0.1, String(clip.durationS))
    check('codec from the file', clip.codec === 'H.264', String(clip.codec))
    check('colour from the file', clip.colourProfile === 'Rec.709', String(clip.colourProfile))
    check('aspect ratio', clip.aspectRatio === '16:9', String(clip.aspectRatio))
    const previewFile = clip.previewKey?.startsWith('/') ? join(process.cwd(), 'public', clip.previewKey) : null
    check('watermarked preview published', Boolean(previewFile && existsSync(previewFile)), String(clip.previewKey))
    check('poster published', clip.thumbnailKeys.length === 1 && existsSync(join(process.cwd(), 'public', clip.thumbnailKeys[0])))
    if (previewFile) {
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=height,codec_name', '-of', 'csv=p=0', previewFile]).stdout.toString().trim()
      check('preview is H.264 at 720 lines', probe === 'h264,720', probe)
    }
    const album = await db.album.findUniqueOrThrow({ where: { id: draft.id } })
    check('album clipCount follows ready clips', album.clipCount === 1)
    check('album runtime + size follow ready clips', album.totalRuntimeS === 3 && Number(album.totalSizeBytes) === size)
    check('first ready clip becomes the cover', album.coverClipId === clip.id)

    // A second upload that never finishes holds the gate closed.
    const pending = await startClipUpload(owner, { albumId: draft.id, name: 'b.mov', type: 'video/quicktime', size: 1000 })
    const gate = await canSubmit(draft.id)
    check('gate names an unfinished clip', gate.reasons.includes('studio.clipsProcessing'))
    check('gate counts only ready clips toward 30', gate.reasons.includes('studio.minClips'))
    if (!('error' in pending)) {
      const pendingRow = await db.clip.findUniqueOrThrow({ where: { id: pending.clipId } })
      await destroyClip(pendingRow)
    }

    // A file that is not video fails ingest with a reason, not a crash.
    const junk = join(workdir, 'junk.mov')
    ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'aac', junk])
    const junkStart = await startClipUpload(owner, { albumId: draft.id, name: 'junk.mov', type: 'video/quicktime', size: statSync(junk).size })
    if (!('error' in junkStart)) {
      const junkParts = await sendParts(junkStart.clipId, junk, statSync(junk).size, 1)
      await completeClipUpload(owner, junkStart.clipId, junkParts)
      await processPending()
      const failed = await db.clip.findUniqueOrThrow({ where: { id: junkStart.clipId } })
      check('audio-only file → failed with a reason code', failed.ingestStatus === 'failed' && failed.ingestError === 'probe', `${failed.ingestStatus}/${failed.ingestError}`)
      check('a failed clip does not count', (await db.album.findUniqueOrThrow({ where: { id: draft.id } })).clipCount === 1)
      await destroyClip(failed)
    }

    // ── Release scans ────────────────────────────────────────────────────
    const release = await db.release.create({
      data: { creatorId: owner.creatorId, type: 'model', fileKey: `pending/${owner.creatorId}`, subjectName: 'Verify' },
    })
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>')
    const asPdf = await attachReleaseDocument(owner, release.id, { bytes: html, name: 'permit.pdf' })
    check('HTML named .pdf → type', 'error' in asPdf && asPdf.error === 'type')
    const big = new Uint8Array(16 * 1024 * 1024)
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d])
    const tooBig = await attachReleaseDocument(owner, release.id, { bytes: big, name: 'big.pdf' })
    check('16 MB → size', 'error' in tooBig && tooBig.error === 'size')
    const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
    check('PDF sniffed from bytes', sniffDocument(pdf) === 'application/pdf')
    const notMine = await attachReleaseDocument(other, release.id, { bytes: pdf, name: 'p.pdf' })
    check("another creator cannot attach", 'error' in notMine && notMine.error === 'not_found')
    const attached = await attachReleaseDocument(owner, release.id, { bytes: pdf, name: 'permit.pdf' })
    check('owner attaches a PDF', 'ok' in attached)
    const withDoc = await db.release.findUniqueOrThrow({ where: { id: release.id } })
    check('scan key is under documents/', withDoc.fileKey.startsWith('documents/releases/'))
    check('mediaUrl() refuses the scan key', mediaUrl(withDoc.fileKey) === null)
    check('scan stored outside public/', existsSync(documentPath(withDoc.fileKey)) && !documentPath(withDoc.fileKey).includes(`${join(process.cwd(), 'public')}/`))
    check('owner may open it', Boolean(await viewableRelease(owner, release.id)))
    check('another creator may not', (await viewableRelease(other, release.id)) === null)
    check('an admin may', Boolean(await viewableRelease({ id: 'x', role: 'admin', creatorId: null }, release.id)))

    await db.release.update({ where: { id: release.id }, data: { verification: 'verified' } })
    const locked = await detachReleaseDocument(owner, release.id)
    check('verified release → scan cannot be removed', 'error' in locked && locked.error === 'verified')
    await db.release.update({ where: { id: release.id }, data: { verification: 'rejected', rejectionReason: 'blurred' } })
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const replaced = await attachReleaseDocument(owner, release.id, { bytes: png, name: 'permit.png' })
    const afterReplace = await db.release.findUniqueOrThrow({ where: { id: release.id } })
    check('replacing a rejected scan → pending again', 'ok' in replaced && afterReplace.verification === 'pending' && !afterReplace.rejectionReason)
    check('the old scan is removed on replace', !existsSync(documentPath(withDoc.fileKey)))
    const removed = await detachReleaseDocument(owner, release.id)
    const afterRemove = await db.release.findUniqueOrThrow({ where: { id: release.id } })
    check('remove → no document', 'ok' in removed && afterRemove.fileUploadedAt === null && !existsSync(documentPath(afterReplace.fileKey)))

    // ── Delete removes row and objects ───────────────────────────────────
    const masterPath = localMasterPath(clip.masterKey!)
    const result = await destroyClip(clip)
    check('delete → ok', result === 'ok')
    check('delete removes the row', (await db.clip.findUnique({ where: { id: clip.id } })) === null)
    check('delete removes the master', !existsSync(masterPath))
    check('delete removes the preview', !previewFile || !existsSync(previewFile))
    const after = await db.album.findUniqueOrThrow({ where: { id: draft.id } })
    check('album totals back to zero, cover cleared', after.clipCount === 0 && after.totalRuntimeS === 0 && after.coverClipId === null)

    // ── HTTP (optional) ──────────────────────────────────────────────────
    const base = process.env.VERIFY_BASE_URL?.replace(/\/+$/, '')
    if (base) {
      const start = await fetch(`${base}/api/studio/uploads`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ albumId: draft.id, ...ok }),
      })
      check('HTTP: start without a session → 401', start.status === 401, String(start.status))
      const doc = await fetch(`${base}/api/studio/releases/${release.id}/document`, { redirect: 'manual' })
      check('HTTP: scan without a session → 401', doc.status === 401, String(doc.status))
      const part = await fetch(`${base}/api/studio/uploads/${clip.id}/part?n=1`, { method: 'PUT', body: 'x' })
      check('HTTP: part without a session → 401', part.status === 401, String(part.status))
      for (const path of ['/.documents/', '/documents/', '/.media/masters/']) {
        const res = await fetch(`${base}${path}x`)
        check(`HTTP: nothing served under ${path}`, res.status === 404, String(res.status))
      }
    } else {
      console.log('  skip  HTTP checks (set VERIFY_BASE_URL)')
    }
  } finally {
    await cleanup()
  }

  console.log(failures === 0 ? '\nverify:uploads passed' : `\nverify:uploads FAILED (${failures})`)
  await db.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (error) => {
  console.error(error)
  await cleanup().catch(() => {})
  await db.$disconnect()
  process.exit(1)
})
