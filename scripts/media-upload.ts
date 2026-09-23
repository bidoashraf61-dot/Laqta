import { MEDIA_OUT, awsMediaConfig, parseFlags } from './media-env'
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { db } from '../lib/db'
import { MEDIA_KEYS, mediaCdnConfigured } from '../lib/media'

/**
 * `npm run media:upload` — push public media to the media bucket and point
 * the database at it.
 *
 * What goes up (all into `S3_MEDIA_BUCKET`, served by CloudFront):
 *   · the hero film — `public/hero/vid/hero-web.mp4` and `hero-web-m.mp4`
 *     → `hero/…` (the app reads them via `lib/media.ts#heroFilmUrl`)
 *   · every preview and poster `npm run media:previews` made
 *     → `previews/<clip>.mp4`, `posters/<clip>.jpg`
 *   · album trailers you cut and drop at `.media/out/trailers/<album>.mp4`
 *     → `trailers/<album>.mp4`
 *
 * What changes in the database, only after that file's upload succeeded:
 *   · `Clip.previewKey`    ← `previews/<clip>.mp4`
 *   · `Clip.thumbnailKeys` ← `[posters/<clip>.jpg]`, only when the clip has no
 *     poster yet, or with `--posters` (a curated still is not overwritten by
 *     an automatic frame unless you say so)
 *   · `Album.trailerKey`   ← `trailers/<album>.mp4`
 *
 * Masters are NEVER uploaded by this script and never go to this bucket — they
 * live in the private masters bucket and are reached only through
 * `/api/download`.
 *
 * ── Without AWS configured it is a dry run, always ──────────────────────────
 * No `AWS_REGION` + `S3_MEDIA_BUCKET` and the script lists what it WOULD upload
 * and change, touches nothing, and exits 0. `--dry-run` does the same with AWS
 * configured. It never reports an upload that did not happen.
 *
 * Flags: --dry-run --force (re-upload even when the bucket has the same size)
 *        --posters --skip-hero --skip-db
 */

const flags = parseFlags()
const aws = awsMediaConfig()
const dryRun = Boolean(flags['dry-run']) || !aws.canUpload
const force = Boolean(flags.force)

type Item = {
  file: string
  key: string
  contentType: string
  apply?: () => Promise<string>
}

function contentType(file: string) {
  switch (extname(file).toLowerCase()) {
    case '.mp4':
      return 'video/mp4'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function list(dir: string, ext: string) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(ext))
    .map((name) => join(dir, name))
}

async function collect(): Promise<Item[]> {
  const items: Item[] = []

  if (!flags['skip-hero']) {
    const heroDir = join(process.cwd(), 'public/hero/vid')
    for (const [local, key] of [
      ['hero-web.mp4', MEDIA_KEYS.heroDesktop],
      ['hero-web-m.mp4', MEDIA_KEYS.heroMobile],
    ] as const) {
      const file = join(heroDir, local)
      if (existsSync(file)) items.push({ file, key, contentType: 'video/mp4' })
      else console.log(`  · hero: ${local} not found in public/hero/vid — skipped`)
    }
  }

  for (const file of list(join(MEDIA_OUT, 'previews'), '.mp4')) {
    const slug = basename(file, '.mp4')
    const key = MEDIA_KEYS.preview(slug)
    items.push({
      file,
      key,
      contentType: 'video/mp4',
      apply: async () => {
        const result = await db.clip.updateMany({ where: { slug }, data: { previewKey: key } })
        return result.count ? `Clip ${slug}.previewKey = ${key}` : `no clip "${slug}" — DB unchanged`
      },
    })
  }

  for (const file of list(join(MEDIA_OUT, 'posters'), '.jpg')) {
    const slug = basename(file, '.jpg')
    const key = MEDIA_KEYS.poster(slug)
    items.push({
      file,
      key,
      contentType: 'image/jpeg',
      apply: async () => {
        const clip = await db.clip.findUnique({ where: { slug }, select: { thumbnailKeys: true } })
        if (!clip) return `no clip "${slug}" — DB unchanged`
        if (clip.thumbnailKeys.length > 0 && !flags.posters) {
          return `Clip ${slug} keeps its poster (pass --posters to replace)`
        }
        await db.clip.update({ where: { slug }, data: { thumbnailKeys: [key] } })
        return `Clip ${slug}.thumbnailKeys = [${key}]`
      },
    })
  }

  for (const file of list(join(MEDIA_OUT, 'trailers'), '.mp4')) {
    const slug = basename(file, '.mp4')
    const key = MEDIA_KEYS.trailer(slug)
    items.push({
      file,
      key,
      contentType: 'video/mp4',
      apply: async () => {
        const result = await db.album.updateMany({ where: { slug }, data: { trailerKey: key } })
        return result.count ? `Album ${slug}.trailerKey = ${key}` : `no album "${slug}" — DB unchanged`
      },
    })
  }

  return items
}

async function main() {
  console.log(
    `media:upload — ${dryRun ? 'DRY RUN' : `to s3://${aws.mediaBucket} (${aws.region})`}` +
      (!aws.canUpload ? '\n  AWS_REGION and S3_MEDIA_BUCKET are not both set: nothing will be uploaded.' : ''),
  )
  if (!mediaCdnConfigured()) {
    console.log(
      '  ⚠ NEXT_PUBLIC_MEDIA_CDN_URL is not set: the app cannot resolve bucket keys, so uploaded\n' +
        '    media stays invisible (pages keep their posters) until it is set and the app rebuilt.',
    )
  }

  const items = await collect()
  if (items.length === 0) {
    console.log('Nothing to upload. Run `npm run media:previews` first, or stage the hero film.')
    await db.$disconnect()
    return
  }

  const { PutObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3')
  const client = dryRun ? null : await (await import('../lib/storage')).s3Client()
  let uploaded = 0
  let unchanged = 0
  let failed = 0

  for (const item of items) {
    const size = statSync(item.file).size
    const mb = (size / 1024 / 1024).toFixed(1)

    if (dryRun || !client) {
      console.log(`  → would upload ${item.key} (${mb} MB)${item.apply ? ' and update the DB' : ''}`)
      continue
    }

    try {
      let same = false
      if (!force) {
        try {
          const head = await client.send(
            new HeadObjectCommand({ Bucket: aws.mediaBucket, Key: item.key }),
          )
          same = head.ContentLength === size
        } catch {
          same = false
        }
      }

      if (same) {
        unchanged++
      } else {
        await client.send(
          new PutObjectCommand({
            Bucket: aws.mediaBucket,
            Key: item.key,
            Body: createReadStream(item.file),
            ContentLength: size,
            ContentType: item.contentType,
            // Keys are stable names that a re-encode overwrites, so not
            // `immutable`: a day at the edge, then revalidate. After replacing
            // a file, invalidate `/<key>` on the distribution to see it now.
            CacheControl: 'public, max-age=86400',
          }),
        )
        uploaded++
        console.log(`  ✓ ${item.key} (${mb} MB)`)
      }

      if (item.apply && !flags['skip-db']) console.log(`    ${await item.apply()}`)
    } catch (error) {
      failed++
      console.error(`  ✗ ${item.key}: ${(error as Error).message}`)
    }
  }

  console.log(
    dryRun
      ? `\n${items.length} file(s) planned. Nothing was uploaded and the database was not changed.`
      : `\nuploaded ${uploaded} · already in the bucket ${unchanged} · failed ${failed}`,
  )
  await db.$disconnect()
  if (failed > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
