import { MEDIA_OUT, MEDIA_WORKDIR, awsMediaConfig, parseFlags } from './media-env'
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { db } from '../lib/db'
import { MEDIA_KEYS } from '../lib/media'
// The ffmpeg half lives in lib/ so the studio's ingest job encodes exactly
// the same preview a creator upload gets as the operator's batch does.
import { encodePreviewAndPoster, hasBinary as has, probeVideo } from '../lib/media-pipeline'

/**
 * `npm run media:previews` — make each clip's public preview from its master.
 *
 * For every clip with a master:
 *   · `.media/out/previews/<clip>.mp4` — 720p (short side), H.264 High,
 *     yuv420p, `+faststart`, no audio, ≤30fps, at most `--max-seconds` long,
 *     with the site's watermark BURNT IN.
 *   · `.media/out/posters/<clip>.jpg` — a clean frame, 1280 on the long side.
 *
 * Then `npm run media:upload` pushes both to the media bucket and points the
 * clip's `previewKey` (and, when it has none, its poster) at them.
 *
 * ── The watermark matches the site's, because it IS the site's ──────────────
 * `components/catalogue/watermark.tsx` draws «لقطة · معاينة»: twelve marks in
 * Thmanyah Serif Display Bold, white, tracking 0.2em, a soft drop shadow, the
 * whole field rotated −24° at 16% opacity. Rather than approximate that in
 * ffmpeg `drawtext` — which here shapes Arabic but does not reorder it, so it
 * prints the word backwards — the same markup is rendered in headless Chrome
 * to a transparent PNG at the preview's exact size and overlaid. Same font,
 * same geometry, correct right-to-left text.
 *
 * Burnt in as well as overlaid on the page: the CSS mark protects what is on
 * screen, but the MP4 itself sits on a public CDN and can be fetched directly.
 * A preview file that is clean is a free master at 720p.
 *
 * Posters stay clean, as every committed still already is — the page overlays
 * the mark on every poster surface (see watermark.tsx).
 *
 * ── Where masters come from ─────────────────────────────────────────────────
 * In order: a "/"-rooted key under `public/`; a file at
 * `<MEDIA_MASTERS_DIR>/<masterKey>` (default `.media/masters`); the private
 * masters bucket when `S3_MASTERS_BUCKET` + `AWS_REGION` are set. None of
 * those and the clip is skipped and SAID to be skipped — never faked.
 *
 * Flags: --album <slug> --clip <slug> --limit <n> --force --dry-run
 *        --max-seconds <n> (default 30)
 */

const flags = parseFlags()
const dryRun = Boolean(flags['dry-run'])
const force = Boolean(flags.force)
const limit = flags.limit ? Number(flags.limit) : undefined
const maxSeconds = flags['max-seconds'] ? Number(flags['max-seconds']) : 30
const mastersDir = process.env.MEDIA_MASTERS_DIR?.trim() || join(MEDIA_WORKDIR, 'masters')

async function fetchMaster(key: string, into: string) {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const { s3Client } = await import('../lib/storage')
  const client = await s3Client()
  const response = await client.send(
    new GetObjectCommand({ Bucket: awsMediaConfig().mastersBucket, Key: key }),
  )
  mkdirSync(dirname(into), { recursive: true })
  await pipeline(response.Body as Readable, createWriteStream(into))
}

type Source = { kind: 'public' | 'local' | 's3'; path: string }

function locateMaster(masterKey: string): Source | null {
  if (masterKey.startsWith('/')) {
    const path = join(process.cwd(), 'public', masterKey)
    return existsSync(path) ? { kind: 'public', path } : null
  }
  const local = join(mastersDir, masterKey)
  if (existsSync(local)) return { kind: 'local', path: local }
  if (awsMediaConfig().canReadMasters) {
    return { kind: 's3', path: join(MEDIA_WORKDIR, 'tmp', masterKey.replace(/\//g, '__')) }
  }
  return null
}

async function main() {
  const ffmpegReady = has('ffmpeg') && has('ffprobe')
  if (!ffmpegReady && !dryRun) {
    console.error('✗ ffmpeg/ffprobe not found on PATH. Install ffmpeg (with libx264) and retry.')
    process.exit(1)
  }

  const clips = await db.clip.findMany({
    where: {
      masterKey: { not: null },
      ...(flags.clip ? { slug: String(flags.clip) } : {}),
      ...(flags.album ? { album: { slug: String(flags.album) } } : {}),
    },
    orderBy: [{ albumId: 'asc' }, { orderIndex: 'asc' }],
    take: limit,
    select: { slug: true, masterKey: true },
  })

  const aws = awsMediaConfig()
  console.log(
    `media:previews — ${clips.length} clip(s) with a master${dryRun ? ' · DRY RUN' : ''}\n` +
      `  masters: public/ → ${mastersDir} → ${aws.canReadMasters ? `s3://${aws.mastersBucket}` : 'S3 not configured'}\n` +
      `  ffmpeg: ${ffmpegReady ? 'found' : 'MISSING'} · out: ${MEDIA_OUT}`,
  )

  const tally = { made: 0, kept: 0, noSource: 0, failed: 0, planned: 0 }

  for (const clip of clips) {
    const masterKey = clip.masterKey!
    const previewOut = join(MEDIA_OUT, MEDIA_KEYS.preview(clip.slug))
    const posterOut = join(MEDIA_OUT, MEDIA_KEYS.poster(clip.slug))

    if (!force && existsSync(previewOut) && existsSync(posterOut)) {
      tally.kept++
      continue
    }

    const source = locateMaster(masterKey)
    if (!source) {
      tally.noSource++
      console.log(`  · ${clip.slug}: no master found for ${masterKey} — skipped`)
      continue
    }

    if (dryRun) {
      tally.planned++
      console.log(`  → ${clip.slug}: would encode from ${source.kind} (${masterKey})`)
      continue
    }

    try {
      if (source.kind === 's3' && !existsSync(source.path)) {
        console.log(`  ↓ ${clip.slug}: fetching ${masterKey}`)
        await fetchMaster(masterKey, source.path)
      }

      const specs = await probeVideo(source.path)
      const size = await encodePreviewAndPoster({
        source: source.path,
        previewOut,
        posterOut,
        specs,
        maxSeconds,
      })

      const kb = Math.round(statSync(previewOut).size / 1024)
      console.log(`  ✓ ${clip.slug}: ${size.width}×${size.height}, ${kb} KB (${extname(source.path) || 'file'} from ${source.kind})`)
      tally.made++
    } catch (error) {
      tally.failed++
      console.error(`  ✗ ${clip.slug}: ${(error as Error).message}`)
    }
  }

  console.log(
    `\nmade ${tally.made} · already present ${tally.kept} · no master ${tally.noSource} · failed ${tally.failed}` +
      (dryRun ? ` · would make ${tally.planned}` : ''),
  )
  if (tally.made > 0) console.log('Next: npm run media:upload')
  await db.$disconnect()
  if (tally.failed > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
