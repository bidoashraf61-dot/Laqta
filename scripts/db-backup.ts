/**
 * Daily database backup (DEV-14).
 *
 *   npm run db:backup
 *
 * `pg_dump` of DATABASE_URL in Postgres's compressed custom format, written to
 * BACKUP_DIR (default .backups/), then — when a bucket is configured — copied
 * off the server to S3 under `backups/`, encrypted at rest. A backup that lives
 * only on the machine it protects is not a backup.
 *
 *   BACKUP_S3_BUCKET   where the copy goes; defaults to S3_MASTERS_BUCKET (the
 *                      private bucket). Unset both: the dump stays local only.
 *   BACKUP_KEEP_LOCAL  how many dumps to keep on disk (default 7). Old copies
 *                      in the bucket are expired by a lifecycle rule
 *                      (docs/tech/hosting.md), not by this script.
 *
 * Needs `pg_dump` on PATH — the production image (Dockerfile) ships the
 * Postgres 17 client. Restore with `npm run db:restore` (scripts/db-restore.ts).
 * Exits non-zero on any failure so the scheduler reports it.
 */
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { s3Client, serverSideEncryption } from '../lib/storage'

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))))
  })
}

/** Prisma's `?schema=public` is not a libpq parameter; pg_dump rejects it. */
export function libpqUrl(url: string) {
  const parsed = new URL(url)
  parsed.searchParams.delete('schema')
  return parsed.toString()
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const configured = process.env.BACKUP_DIR ?? '.backups'
  const dir = isAbsolute(configured) ? configured : join(process.cwd(), configured)
  await mkdir(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = join(dir, `laqta-${stamp}.dump`)
  await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', `--file=${file}`, libpqUrl(url)])
  const size = (await stat(file)).size
  if (size < 1024) throw new Error(`the dump is ${size} bytes — refusing to call that a backup`)
  console.log(`[backup] wrote ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`)

  const bucket = (process.env.BACKUP_S3_BUCKET || process.env.S3_MASTERS_BUCKET || '').trim()
  if (bucket) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const key = `backups/${file.split('/').pop()}`
    await (await s3Client()).send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(file),
        ContentLength: size,
        ContentType: 'application/octet-stream',
        ...serverSideEncryption(),
      }),
    )
    console.log(`[backup] copied to s3://${bucket}/${key}`)
  } else {
    console.warn('[backup] no BACKUP_S3_BUCKET or S3_MASTERS_BUCKET: this backup exists on this server only')
  }

  const keep = Math.max(1, Number(process.env.BACKUP_KEEP_LOCAL ?? 7) || 7)
  const dumps = (await readdir(dir)).filter((name) => /^laqta-.*\.dump$/.test(name)).sort()
  for (const old of dumps.slice(0, Math.max(0, dumps.length - keep))) await rm(join(dir, old))
}

main().catch((error) => {
  console.error('[backup] FAILED:', error instanceof Error ? error.message : error)
  process.exit(1)
})
