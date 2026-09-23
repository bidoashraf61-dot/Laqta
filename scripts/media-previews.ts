import { MEDIA_OUT, MEDIA_WORKDIR, awsMediaConfig, parseFlags } from './media-env'
import { spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { db } from '../lib/db'
import { MEDIA_KEYS } from '../lib/media'

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

const WATERMARK_TEXT = 'لقطة · معاينة'
const WATERMARK_FONT = join(
  process.cwd(),
  'public/fonts/thmanyah/thmanyahserifdisplay-Bold.woff2',
)

function has(binary: string) {
  return spawnSync(binary, ['-version'], { stdio: 'ignore' }).status === 0
}

function run(binary: string, args: string[]) {
  const result = spawnSync(binary, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${binary} failed: ${(result.stderr || '').split('\n').slice(-6).join('\n')}`)
  }
  return result.stdout
}

function probe(file: string) {
  const out = run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    file,
  ])
  const json = JSON.parse(out) as {
    streams: { width: number; height: number; side_data_list?: { rotation?: number }[] }[]
    format: { duration?: string }
  }
  const stream = json.streams[0]
  if (!stream) throw new Error('no video stream')
  const rotation = Math.abs(stream.side_data_list?.[0]?.rotation ?? 0)
  // A phone master stored landscape with a 90° flag plays portrait; ffmpeg
  // auto-rotates on decode, so size the output for what actually plays.
  const [width, height] = rotation === 90 || rotation === 270
    ? [stream.height, stream.width]
    : [stream.width, stream.height]
  return { width, height, duration: Number(json.format.duration ?? 0) }
}

/** Short side 720 (never upscaled), both sides even — H.264 needs that. */
function previewSize(width: number, height: number) {
  const short = Math.min(width, height)
  const scale = Math.min(1, 720 / short)
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2)
  return { width: even(width), height: even(height) }
}

/**
 * The site's watermark, rendered by Chrome to a transparent PNG.
 *
 * Laid out in a CSS box 800px wide — about the width of the album page's
 * player, where the site's overlay was tuned — and scaled up to the preview's
 * pixel size, so the mark reads at the same proportion in the file as it does
 * on the page.
 */
async function renderWatermark(width: number, height: number): Promise<string> {
  const file = join(MEDIA_WORKDIR, 'watermark', `${width}x${height}.png`)
  if (existsSync(file)) return file
  mkdirSync(dirname(file), { recursive: true })

  const cssWidth = 800
  const cssHeight = Math.round((cssWidth * height) / width)
  const font = readFileSync(WATERMARK_FONT).toString('base64')
  // 48 marks, not the page's 12. The page cut to 12 purely for DOM cost
  // (1,392 spans stalled Safari — see watermark.tsx); a PNG has no DOM, and
  // 12 marks in a file make one diagonal band that a crop removes. 48 is the
  // mark's original density: the same field, blanketed.
  const marks = Array.from({ length: 48 }, () => `<span>${WATERMARK_TEXT}</span>`).join('')

  const html = `<!doctype html><html dir="rtl"><head><style>
    @font-face { font-family: 'Thmanyah Serif Display'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 700; }
    html, body { margin: 0; background: transparent; }
    .frame { position: relative; width: ${cssWidth}px; height: ${cssHeight}px; overflow: hidden; }
    .field { position: absolute; inset: -25%; display: flex; flex-wrap: wrap; align-content: center;
      align-items: center; justify-content: center; column-gap: 2rem; row-gap: 1.5rem;
      transform: rotate(-24deg); opacity: 0.16; }
    span { white-space: nowrap; font-family: 'Thmanyah Serif Display'; font-weight: 700; font-size: 0.75rem;
      letter-spacing: 0.2em; color: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }
  </style></head><body><div class="frame"><div class="field">${marks}</div></div></body></html>`

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: cssWidth, height: cssHeight },
      deviceScaleFactor: width / cssWidth,
    })
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)
    await page.locator('.frame').screenshot({ path: file, omitBackground: true })
  } finally {
    await browser.close()
  }
  return file
}

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

      const { width, height, duration } = probe(source.path)
      const size = previewSize(width, height)
      const watermark = await renderWatermark(size.width, size.height)
      mkdirSync(dirname(previewOut), { recursive: true })
      mkdirSync(dirname(posterOut), { recursive: true })

      run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', source.path,
        '-i', watermark,
        '-filter_complex',
        `[0:v]scale=${size.width}:${size.height}:flags=lanczos,setsar=1[v];` +
          // A fractional device scale can leave the PNG a pixel off; pin it.
          `[1:v]scale=${size.width}:${size.height}[wm];` +
          `[v][wm]overlay=0:0:format=auto,format=yuv420p[out]`,
        '-map', '[out]',
        '-an',
        '-t', String(maxSeconds),
        '-fpsmax', '30',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
        '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        previewOut,
      ])

      // A frame a third of the way in (at most 2s): the first frame of a
      // shot is often a fade or a slate.
      const at = Math.min(2, Math.max(0, duration / 3))
      const long = Math.max(width, height) > 1280
      run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-ss', at.toFixed(2),
        '-i', source.path,
        '-frames:v', '1',
        ...(long
          ? ['-vf', width >= height ? 'scale=1280:-2:flags=lanczos' : 'scale=-2:1280:flags=lanczos']
          : []),
        '-q:v', '3',
        posterOut,
      ])

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
