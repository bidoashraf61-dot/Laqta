import { spawn, spawnSync } from 'node:child_process'
import { DHASH_HEIGHT, DHASH_WIDTH, dHashFromPixels } from '@/lib/phash'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The media pipeline's ffmpeg half — shared by `npm run media:previews`
 * (the operator's batch) and the studio ingest job (`lib/ingest.ts`), so a
 * creator's upload and an operator's re-encode produce byte-for-byte the same
 * kind of preview: same size rule, same encoder settings, same burnt-in mark.
 *
 * Server-only (Node child processes). Needs `ffmpeg` + `ffprobe` on PATH, and
 * Chrome for the watermark — the same Chrome `lib/documents.ts` prints
 * certificates with.
 */

/** Everything the pipeline writes locally. Gitignored. */
export const MEDIA_WORKDIR = join(process.cwd(), '.media')
export const MEDIA_OUT = join(MEDIA_WORKDIR, 'out')

const WATERMARK_TEXT = 'لقطة · معاينة'
const WATERMARK_FONT = join(process.cwd(), 'public/fonts/thmanyah/thmanyahserifdisplay-Bold.woff2')

const found = new Map<string, boolean>()

/** Is `binary` on PATH? Asked once per process — the answer does not change. */
export function hasBinary(binary: string) {
  if (!found.has(binary)) {
    found.set(binary, spawnSync(binary, ['-version'], { stdio: 'ignore' }).status === 0)
  }
  return found.get(binary)!
}

/**
 * Run a binary WITHOUT blocking the event loop. The batch script could afford
 * `spawnSync`; the ingest job runs inside the web server, where a synchronous
 * ten-second encode would freeze every request in the process.
 */
export function runBinary(binary: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`${binary} failed: ${stderr.split('\n').slice(-6).join('\n')}`))
    })
  })
}

type ProbeStream = {
  codec_type?: string
  codec_name?: string
  profile?: string
  width?: number
  height?: number
  r_frame_rate?: string
  avg_frame_rate?: string
  bit_rate?: string
  pix_fmt?: string
  color_transfer?: string
  color_primaries?: string
  color_space?: string
  side_data_list?: { rotation?: number }[]
  tags?: { rotate?: string }
}

export type VideoSpecs = {
  /** As it PLAYS — rotation applied. */
  width: number
  height: number
  fps: number
  durationS: number
  /** `h264` / `hevc` / `prores` — ffprobe's codec name. */
  codecName: string
  /** Human form stored on the clip: `H.264`, `H.265`, `ProRes 422 HQ`. */
  codec: string
  bitrateKbps: number | null
  /** `Rec.709` / `Rec.2020` / `HLG` / `PQ`, or null when the file does not say. */
  colourProfile: string | null
  aspectRatio: string
  /** ffprobe's `format_name`, e.g. `mov,mp4,m4a,3gp,3g2,mj2`. */
  container: string
}

function parseRate(rate: string | undefined) {
  if (!rate) return 0
  const [num, den] = rate.split('/').map(Number)
  if (!den) return Number(num) || 0
  return num / den
}

function codecLabel(name: string, profile: string | undefined) {
  if (name === 'h264') return 'H.264'
  if (name === 'hevc') return 'H.265'
  if (name === 'prores') return profile ? `ProRes ${profile}` : 'ProRes'
  return name
}

/**
 * Colour, only as far as the file itself declares it. A LOG profile is not
 * detectable from metadata (S-Log3 in a Rec.709 wrapper is common), so this
 * never claims LOG — `null` is the honest answer when the tags are absent.
 */
function colourFrom(stream: ProbeStream): string | null {
  const transfer = stream.color_transfer
  if (transfer === 'arib-std-b67') return 'HLG'
  if (transfer === 'smpte2084') return 'PQ'
  if (stream.color_primaries === 'bt2020' || stream.color_space?.startsWith('bt2020')) return 'Rec.2020'
  if (transfer === 'bt709' || stream.color_primaries === 'bt709' || stream.color_space === 'bt709') return 'Rec.709'
  return null
}

function ratioLabel(width: number, height: number) {
  const r = width / height
  const known: [number, string][] = [
    [16 / 9, '16:9'],
    [9 / 16, '9:16'],
    [1, '1:1'],
    [2.39, '2.39:1'],
    [256 / 135, '17:9'],
    [4 / 3, '4:3'],
    [4 / 5, '4:5'],
  ]
  const hit = known.find(([value]) => Math.abs(value - r) < 0.02)
  return hit ? hit[1] : `${(r >= 1 ? r : 1 / r).toFixed(2)}:1`
}

/** Read a file's video specs with ffprobe. Throws when there is no video. */
export async function probeVideo(file: string): Promise<VideoSpecs> {
  const out = await runBinary('ffprobe', [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    file,
  ])
  const json = JSON.parse(out) as {
    streams: ProbeStream[]
    format: { duration?: string; format_name?: string; bit_rate?: string }
  }
  const stream = json.streams.find((s) => s.codec_type === 'video')
  if (!stream || !stream.width || !stream.height) throw new Error('no video stream')

  const rotation = Math.abs(
    stream.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ??
      Number(stream.tags?.rotate ?? 0),
  )
  // A phone master stored landscape with a 90° flag plays portrait; ffmpeg
  // auto-rotates on decode, so size everything for what actually plays.
  const [width, height] =
    rotation === 90 || rotation === 270 ? [stream.height, stream.width] : [stream.width, stream.height]

  const fps = parseRate(stream.avg_frame_rate) || parseRate(stream.r_frame_rate)
  const bitrate = Number(stream.bit_rate ?? json.format.bit_rate ?? 0)

  return {
    width,
    height,
    fps: Math.round(fps * 1000) / 1000,
    durationS: Math.round(Number(json.format.duration ?? 0) * 1000) / 1000,
    codecName: stream.codec_name ?? '',
    codec: codecLabel(stream.codec_name ?? '', stream.profile),
    bitrateKbps: bitrate ? Math.round(bitrate / 1000) : null,
    colourProfile: colourFrom(stream),
    aspectRatio: ratioLabel(width, height),
    container: json.format.format_name ?? '',
  }
}

/** Short side 720 (never upscaled), both sides even — H.264 needs that. */
export function previewSize(width: number, height: number) {
  const short = Math.min(width, height)
  const scale = Math.min(1, 720 / short)
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2)
  return { width: even(width), height: even(height) }
}

/**
 * The site's watermark, rendered by Chrome to a transparent PNG.
 *
 * `components/catalogue/watermark.tsx` draws «لقطة · معاينة»: Thmanyah Serif
 * Display Bold, white, tracking 0.2em, a soft drop shadow, the field rotated
 * −24° at 16% opacity. ffmpeg `drawtext` shapes Arabic but does not reorder
 * it (it prints the word backwards), so the same markup is rendered by Chrome
 * at the preview's exact size and overlaid.
 *
 * Laid out in a CSS box 800px wide — about the album player's width, where the
 * page's overlay was tuned — and scaled to the preview's pixel size. Cached by
 * size under `.media/watermark/`.
 */
export async function renderWatermark(width: number, height: number): Promise<string> {
  const file = join(MEDIA_WORKDIR, 'watermark', `${width}x${height}.png`)
  if (existsSync(file)) return file
  mkdirSync(dirname(file), { recursive: true })

  const cssWidth = 800
  const cssHeight = Math.round((cssWidth * height) / width)
  const font = readFileSync(WATERMARK_FONT).toString('base64')
  // 48 marks, not the page's 12. The page cut to 12 purely for DOM cost; a
  // PNG has no DOM, and 12 marks make one diagonal band a crop removes.
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
    // Write to a temp name and rename: two encodes of the same size at once
    // must never read a half-written PNG.
    const tmp = `${file}.${process.pid}.${Date.now()}.png`
    await page.locator('.frame').screenshot({ path: tmp, omitBackground: true })
    const { renameSync } = await import('node:fs')
    renameSync(tmp, file)
  } finally {
    await browser.close()
  }
  return file
}

/**
 * Encode the public preview: 720p short side, H.264 High, yuv420p,
 * `+faststart`, no audio, ≤30fps, at most `maxSeconds`, watermark burnt in.
 * And the poster: a CLEAN frame a third of the way in (≤2s), 1280 long side.
 *
 * Burnt in as well as overlaid on the page: the MP4 sits on a public CDN and
 * can be fetched directly — a clean preview file is a free master at 720p.
 */
export async function encodePreviewAndPoster(input: {
  source: string
  previewOut: string
  posterOut: string
  specs: Pick<VideoSpecs, 'width' | 'height' | 'durationS'>
  maxSeconds?: number
}) {
  const { source, previewOut, posterOut, specs } = input
  const maxSeconds = input.maxSeconds ?? 30
  const size = previewSize(specs.width, specs.height)
  const watermark = await renderWatermark(size.width, size.height)
  mkdirSync(dirname(previewOut), { recursive: true })
  mkdirSync(dirname(posterOut), { recursive: true })

  await runBinary('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', source,
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

  // A frame a third of the way in (at most 2s): the first frame of a shot is
  // often a fade or a slate.
  const at = Math.min(2, Math.max(0, specs.durationS / 3))
  const long = Math.max(specs.width, specs.height) > 1280
  await runBinary('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', at.toFixed(2),
    '-i', source,
    '-frames:v', '1',
    ...(long
      ? ['-vf', specs.width >= specs.height ? 'scale=1280:-2:flags=lanczos' : 'scale=-2:1280:flags=lanczos']
      : []),
    '-q:v', '3',
    posterOut,
  ])

  return size
}

/**
 * The clip's perceptual hash (DEV-18): one frame from the middle — past any
 * fade-in — shrunk to 9×8 greys by ffmpeg, then `dHashFromPixels`. Null when
 * the frame cannot be read; a missing hash only means no duplicate check,
 * never a failed ingest.
 */
export function perceptualHashOf(file: string, durationS: number): Promise<string | null> {
  const at = Math.max(0, durationS / 2).toFixed(3)
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-ss', at, '-i', file,
      '-frames:v', '1',
      '-vf', `scale=${DHASH_WIDTH}:${DHASH_HEIGHT}:flags=area,format=gray`,
      '-f', 'rawvideo', 'pipe:1',
    ])
    const chunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.on('error', () => resolve(null))
    child.on('close', (code) => {
      const pixels = Buffer.concat(chunks)
      if (code !== 0 || pixels.length < DHASH_WIDTH * DHASH_HEIGHT) return resolve(null)
      try {
        resolve(dHashFromPixels(new Uint8Array(pixels)))
      } catch {
        resolve(null)
      }
    })
  })
}
