/**
 * Restore a backup (DEV-14; rehearsed once in DEV-56).
 *
 *   RESTORE_DATABASE_URL=postgres://…/laqta_restore npm run db:restore -- <file.dump | s3 key>
 *
 * Restores INTO RESTORE_DATABASE_URL — an empty scratch database, never the
 * live one by accident: if it equals DATABASE_URL the script refuses unless
 * `--into-live` is passed as well. The source is a local .dump file, or a key
 * under `backups/` in BACKUP_S3_BUCKET / S3_MASTERS_BUCKET, which is downloaded
 * first. Prints row counts afterwards so the restore can be compared with the
 * live site.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { PrismaClient } from '@prisma/client'
import { s3Client } from '../lib/storage'

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))))
  })
}

const libpqUrl = (url: string) => {
  const parsed = new URL(url)
  parsed.searchParams.delete('schema')
  return parsed.toString()
}

async function main() {
  const source = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  const intoLive = process.argv.includes('--into-live')
  const target = process.env.RESTORE_DATABASE_URL
  if (!source) throw new Error('name a .dump file or an S3 key: npm run db:restore -- backups/laqta-….dump')
  if (!target) throw new Error('set RESTORE_DATABASE_URL to the (empty) database to restore into')
  if (target === process.env.DATABASE_URL && !intoLive) {
    throw new Error('RESTORE_DATABASE_URL is the live database. Pass --into-live only if you mean to overwrite it.')
  }

  let file = source
  if (!existsSync(source)) {
    const bucket = (process.env.BACKUP_S3_BUCKET || process.env.S3_MASTERS_BUCKET || '').trim()
    if (!bucket) throw new Error(`${source} is not a local file and no bucket is configured`)
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const object = await (await s3Client()).send(new GetObjectCommand({ Bucket: bucket, Key: source }))
    await mkdir(join(process.cwd(), '.backups'), { recursive: true })
    file = join(process.cwd(), '.backups', source.split('/').pop()!)
    await pipeline(object.Body as Readable, createWriteStream(file))
    console.log(`[restore] downloaded s3://${bucket}/${source}`)
  }

  await run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-acl', `--dbname=${libpqUrl(target)}`, file])

  const db = new PrismaClient({ datasourceUrl: target })
  const [users, albums, orders, paid] = await Promise.all([
    db.user.count(),
    db.album.count(),
    db.order.count(),
    db.order.count({ where: { status: 'paid' } }),
  ])
  await db.$disconnect()
  console.log(`[restore] done: ${users} users, ${albums} albums, ${orders} orders (${paid} paid)`)
}

main().catch((error) => {
  console.error('[restore] FAILED:', error instanceof Error ? error.message : error)
  process.exit(1)
})
