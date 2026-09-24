import './media-env'
import { db } from '../lib/db'
import { processPending } from '../lib/ingest'
import { hasBinary } from '../lib/media-pipeline'

/**
 * `npm run media:ingest` — drain the studio ingest queue once.
 *
 * The web process already drains it after every completed upload
 * (`ingestSoon()`); this is the same worker for a cron, a deploy hook, or a
 * server restart that interrupted an encode. Clips stuck in `probing` /
 * `transcoding` for over an hour go back in the queue first.
 *
 * Flags: --limit <n>
 */
async function main() {
  if (!hasBinary('ffmpeg') || !hasBinary('ffprobe')) {
    console.error('✗ ffmpeg/ffprobe not found on PATH. Install ffmpeg (with libx264) and retry.')
    process.exit(1)
  }
  const at = process.argv.indexOf('--limit')
  const limit = at > -1 ? Number(process.argv[at + 1]) : Infinity
  const results = await processPending(limit)
  for (const { clipId, result } of results) console.log(`  ${result === 'ready' ? '✓' : '✗'} ${clipId}: ${result}`)
  console.log(`media:ingest — ${results.length} clip(s) processed`)
  await db.$disconnect()
  if (results.some((r) => r.result !== 'ready')) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
