/**
 * Shared set-up for the media pipeline scripts (`media:previews`,
 * `media:upload`).
 *
 * Imported FIRST by each script, for its side effect: `.env` is loaded before
 * any `lib/` module reads `process.env` at import time. Next.js loads `.env`
 * for the app; a plain `tsx` script gets nothing unless it asks.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

for (const file of ['.env.local', '.env']) {
  const path = join(process.cwd(), file)
  // Earlier files win: loadEnvFile never overwrites a variable already set.
  if (existsSync(path)) process.loadEnvFile(path)
}

/** Everything the pipeline writes locally. Gitignored. */
export const MEDIA_WORKDIR = join(process.cwd(), '.media')
export const MEDIA_OUT = join(MEDIA_WORKDIR, 'out')

export function awsMediaConfig() {
  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || ''
  const mediaBucket = process.env.S3_MEDIA_BUCKET?.trim() || ''
  const mastersBucket = process.env.S3_MASTERS_BUCKET?.trim() || ''
  return {
    region,
    mediaBucket,
    mastersBucket,
    /** Can we push to the public media bucket? */
    canUpload: Boolean(region && mediaBucket),
    /** Can we pull masters from the private bucket? */
    canReadMasters: Boolean(region && mastersBucket),
  }
}

export type Flags = Record<string, string | boolean>

/** `--album alula --force --limit 3` → `{ album: 'alula', force: true, limit: '3' }`. */
export function parseFlags(argv = process.argv.slice(2)): Flags {
  const flags: Flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const name = arg.slice(2)
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags[name] = next
      i++
    } else {
      flags[name] = true
    }
  }
  return flags
}
