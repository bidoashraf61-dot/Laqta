import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '@/lib/db'
import { MEDIA_KEYS } from '@/lib/media'
import { MEDIA_OUT, encodePreviewAndPoster, hasBinary, perceptualHashOf, probeVideo } from '@/lib/media-pipeline'
import { ACCEPTED_CODECS, materialiseMaster, publishPublicMedia, refreshAlbumTotals } from '@/lib/uploads'

/**
 * Ingest: a creator's uploaded master → specs, preview, poster, `ready`.
 *
 * ── The queue is the Clip table ─────────────────────────────────────────────
 * `ingestStatus = uploaded` IS the job. A worker claims a clip with a
 * conditional update (`uploaded → probing`), so two workers — the web
 * process's `ingestSoon()` and a cron `npm run media:ingest` — can never both
 * encode one clip. The same posture as the mail outbox: no extra queue table,
 * and "what is stuck?" is a query the studio already renders.
 *
 * A worker that dies mid-encode leaves a clip in `probing`/`transcoding`;
 * `recoverStale()` hands it back to the queue after `STALE_MINUTES`.
 *
 * ── Specs come from the file, never from the browser ────────────────────────
 * Width, height, fps, duration, codec and colour are read by ffprobe from the
 * stored master. The consistency check and the reviewer both read these
 * columns; a client that could set them could hide a 24p clip in a 60p album.
 * ────────────────────────────────────────────────────────────────────────────
 */

const STALE_MINUTES = 60

export type IngestFailure = 'missing' | 'probe' | 'container' | 'codec' | 'preview'

class IngestError extends Error {
  constructor(readonly code: IngestFailure, detail: string) {
    super(detail)
  }
}

/** Put clips whose worker vanished back in the queue. */
export async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000)
  await db.clip.updateMany({
    where: { ingestStatus: { in: ['probing', 'transcoding'] }, updatedAt: { lt: cutoff } },
    data: { ingestStatus: 'uploaded' },
  })
}

/** Claim one waiting clip, or null when the queue is empty. */
async function claimNext(): Promise<string | null> {
  for (let tries = 0; tries < 5; tries++) {
    const next = await db.clip.findFirst({
      where: { ingestStatus: 'uploaded', masterKey: { not: null } },
      orderBy: { updatedAt: 'asc' },
      select: { id: true },
    })
    if (!next) return null
    const claimed = await db.clip.updateMany({
      where: { id: next.id, ingestStatus: 'uploaded' },
      data: { ingestStatus: 'probing', ingestError: null },
    })
    if (claimed.count === 1) return next.id
  }
  return null
}

/** Process one claimed clip end to end. Never throws — failure is a state. */
export async function processClip(clipId: string): Promise<'ready' | IngestFailure> {
  const clip = await db.clip.findUnique({
    where: { id: clipId },
    select: { id: true, slug: true, albumId: true, masterKey: true },
  })
  if (!clip?.masterKey) return 'missing'

  let temp: string | null = null
  try {
    const master = await materialiseMaster(clip.masterKey).catch(() => null)
    if (!master) throw new IngestError('missing', `no master at ${clip.masterKey}`)
    if (master.temporary) temp = master.path

    let specs
    try {
      specs = await probeVideo(master.path)
    } catch (error) {
      throw new IngestError('probe', (error as Error).message)
    }
    if (!/mov|mp4/.test(specs.container)) throw new IngestError('container', specs.container)
    if (!ACCEPTED_CODECS.has(specs.codecName)) throw new IngestError('codec', specs.codecName)
    if (!specs.durationS || !specs.fps) throw new IngestError('probe', 'no duration or frame rate')

    // Specs land before the encode, so the studio shows real numbers while
    // the preview is still being made.
    await db.clip.update({
      where: { id: clip.id },
      data: {
        ingestStatus: 'transcoding',
        width: specs.width,
        height: specs.height,
        fps: specs.fps,
        durationS: specs.durationS,
        codec: specs.codec,
        bitrateKbps: specs.bitrateKbps,
        colourProfile: specs.colourProfile,
        aspectRatio: specs.aspectRatio,
      },
    })

    const previewOut = join(MEDIA_OUT, MEDIA_KEYS.preview(clip.slug))
    const posterOut = join(MEDIA_OUT, MEDIA_KEYS.poster(clip.slug))
    let previewKey: string
    let posterKey: string
    try {
      await encodePreviewAndPoster({ source: master.path, previewOut, posterOut, specs })
      previewKey = await publishPublicMedia(previewOut, MEDIA_KEYS.preview(clip.slug), 'video/mp4')
      posterKey = await publishPublicMedia(posterOut, MEDIA_KEYS.poster(clip.slug), 'image/jpeg')
    } catch (error) {
      throw new IngestError('preview', (error as Error).message)
    }

    // The fingerprint the review queue's duplicate check compares (DEV-18).
    // Best effort: without it the clip is simply not matched.
    const perceptualHash = await perceptualHashOf(master.path, specs.durationS)

    await db.clip.update({
      where: { id: clip.id },
      data: { ingestStatus: 'ready', ingestError: null, previewKey, thumbnailKeys: [posterKey], perceptualHash },
    })
    await refreshAlbumTotals(clip.albumId)
    return 'ready'
  } catch (error) {
    const code = error instanceof IngestError ? error.code : 'preview'
    console.error(`[ingest] ${clip.slug} failed (${code}):`, (error as Error).message)
    await db.clip
      .update({ where: { id: clip.id }, data: { ingestStatus: 'failed', ingestError: code } })
      .catch(() => {})
    await refreshAlbumTotals(clip.albumId).catch(() => {})
    return code
  } finally {
    if (temp) await rm(temp, { force: true }).catch(() => {})
  }
}

/** Drain the queue, one clip at a time. Returns what was processed. */
export async function processPending(limit = Infinity) {
  await recoverStale()
  const results: { clipId: string; result: string }[] = []
  while (results.length < limit) {
    const id = await claimNext()
    if (!id) break
    results.push({ clipId: id, result: await processClip(id) })
  }
  return results
}

let running: Promise<unknown> | null = null
let again = false

/**
 * Fire-and-forget from a request (an upload just completed). One drain per
 * process at a time — encodes are CPU-bound and serialising them keeps the
 * web server answering; a second call while one runs just asks for another
 * pass when it finishes.
 */
export function ingestSoon() {
  if (!hasBinary('ffmpeg') || !hasBinary('ffprobe')) {
    console.error('[ingest] ffmpeg/ffprobe not on PATH — clips stay queued as `uploaded`')
    return
  }
  if (running) {
    again = true
    return
  }
  running = processPending()
    .catch((error) => console.error('[ingest] drain failed:', error))
    .finally(() => {
      running = null
      if (again) {
        again = false
        ingestSoon()
      }
    })
}
