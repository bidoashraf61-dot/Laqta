/**
 * Watermarked-preview downloads ("comps").
 *
 *   npm run verify:previews                      (DB on :5433)
 *   VERIFY_BASE_URL=http://localhost:3000 npm run verify:previews   (+ HTTP checks)
 *
 * The one thing this feature must never do is serve a clip's clean proxy or
 * its master. Everything else — limits, logging, the ZIP — is checked too, but
 * that guard is why the gate exists.
 */

import { statSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'
import {
  PreviewRefusedError,
  compFilename,
  grantComp,
  previewSource,
  servablePreviewKey,
} from '@/lib/previews'
import { readZipDirectory, zipSize, zipStream } from '@/lib/zip-stream'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

function refused(clip: Parameters<typeof servablePreviewKey>[0]) {
  try {
    servablePreviewKey(clip)
    return false
  } catch (error) {
    return error instanceof PreviewRefusedError
  }
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

async function main() {
  console.log('Preview downloads\n')

  // ── The key guard ───────────────────────────────────────────────────────
  check('no preview → refused', refused({ previewKey: null }))
  check('proxy prefix → refused', refused({ previewKey: 'proxies/a/b.mp4' }))
  check('master prefix → refused', refused({ previewKey: 'masters/a/b.mov' }))
  check('album zip prefix → refused', refused({ previewKey: 'albums/x.zip' }))
  check('CDN URL into a private prefix → refused', refused({ previewKey: 'https://cdn.x/proxies/a.mp4' }))
  check('traversal → refused', refused({ previewKey: '/hero/../../.env' }))
  check(
    'preview equal to the proxy → refused',
    refused({ previewKey: 'previews/a.mp4', proxyKey: 'previews/a.mp4' }),
  )
  check(
    'preview equal to the master → refused',
    refused({ previewKey: 'previews/a.mp4', masterKey: 'previews/a.mp4' }),
  )
  check(
    'a public preview key is served as itself',
    servablePreviewKey({ previewKey: 'previews/a.mp4', proxyKey: 'proxies/a.mp4' }) === 'previews/a.mp4',
  )

  // ── What the routes would read, for a real live clip ───────────────────
  const clip = await db.clip.findFirst({
    where: { album: { status: 'live' }, previewKey: { startsWith: '/' } },
    select: { id: true, previewKey: true, proxyKey: true, masterKey: true, albumId: true, album: { select: { slug: true } } },
  })
  if (!clip) {
    check('a live clip with a local preview exists', false, 'seed has none')
  } else {
    const key = servablePreviewKey(clip)
    const source = await previewSource(key)
    const onDisk = statSync(join(process.cwd(), 'public', key)).size
    check('served bytes are the previewKey file', source?.size === onDisk, `${source?.size} vs ${onDisk}`)
    check(
      'filename names album, position and preview',
      compFilename(clip.album.slug, 7, key) === `${clip.album.slug}_clip-07_laqta-preview.mp4`,
    )

    // ── ZIP: exact entries, readable directory ───────────────────────────
    if (source) {
      const entries = [1, 2].map((n) => ({
        name: compFilename(clip.album.slug, n, key),
        size: source.size,
        open: source.open,
      }))
      const zip = await collect(zipStream(entries))
      check('zip length matches the declared Content-Length', zip.length === zipSize(entries))
      const names = readZipDirectory(zip).map((entry) => entry.name)
      check(
        'zip holds exactly the album previews',
        names.length === 2 && names.every((name, i) => name === entries[i].name),
        names.join(', '),
      )
    }
  }

  // ── Limits and the log ─────────────────────────────────────────────────
  const user = await db.user.findFirst({ where: { email: 'buyer@agency.sa' }, select: { id: true } })
  if (!user || !clip) {
    check('seed buyer exists', false)
  } else {
    process.env.PREVIEW_CLIPS_PER_HOUR = '2'
    process.env.PREVIEW_ZIPS_PER_DAY = '1'
    const since = new Date()
    try {
      const base = { userId: user.id, albumId: clip.albumId, fileCount: 1, ip: null, userAgent: 'verify' }
      // Clear this hour's history for the seed buyer so the count starts at 0.
      await db.compDownload.deleteMany({
        where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      })
      const a = await grantComp({ ...base, clipId: clip.id })
      const b = await grantComp({ ...base, clipId: clip.id })
      const c = await grantComp({ ...base, clipId: clip.id })
      check('clip comps allowed up to the hourly limit', a.ok && b.ok)
      check('clip comp over the limit is refused', !c.ok)
      const z1 = await grantComp({ ...base, clipId: null })
      const z2 = await grantComp({ ...base, clipId: null })
      check('album zip limit is counted separately and trips', z1.ok && !z2.ok)
      const logged = await db.compDownload.count({ where: { userId: user.id, createdAt: { gte: since } } })
      check('every granted download is logged, refusals are not', logged === 3, `${logged} rows`)
    } finally {
      await db.compDownload.deleteMany({ where: { userId: user.id, createdAt: { gte: since } } })
    }
  }

  // ── HTTP (only with a server) ──────────────────────────────────────────
  const base = process.env.VERIFY_BASE_URL
  if (base && clip) {
    const res = await fetch(`${base}/api/preview/${clip.id}`, { redirect: 'manual' })
    check('signed-out clip comp → 401', res.status === 401, String(res.status))
    const back = await fetch(`${base}/api/preview/${clip.id}?back=%2Fen%2Ffootage`, { redirect: 'manual' })
    check(
      'signed-out with a page → sign-in, returning there',
      back.status === 303 && (back.headers.get('location') ?? '').includes('/en/sign-in?callbackUrl=%2Fen%2Ffootage'),
      back.headers.get('location') ?? String(back.status),
    )
    const zip = await fetch(`${base}/api/preview/album/${clip.albumId}`, { redirect: 'manual' })
    check('signed-out album zip → 401', zip.status === 401, String(zip.status))
    const open = await fetch(`${base}/api/preview/${clip.id}?back=%2F%2Fevil.example`, { redirect: 'manual' })
    check('an off-site back is ignored (no open redirect)', open.status === 401, String(open.status))
  } else {
    console.log('  skip  HTTP checks (set VERIFY_BASE_URL)')
  }

  await db.$disconnect()
  console.log(failures ? `\n${failures} preview check(s) failed.` : '\nPreviews serve only the watermarked file, to signed-in users, within limits.')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
