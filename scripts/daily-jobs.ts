/**
 * The daily jobs (DEV-30 transfer reminders, DEV-57 operator digest), from a
 * shell — run once a day by cron on the server:
 *
 *   0 7 * * *  cd /app && npm run jobs:daily
 *
 * Or let a hosted scheduler POST /api/cron/daily with CRON_SECRET.
 */
import { runDailyJobs } from '../lib/jobs'
import { db } from '../lib/db'

runDailyJobs()
  .then((result) => {
    console.log(`[jobs] reminders queued: ${result.reminders} · digest: ${result.digest ? 'queued' : 'skipped'} · mail drained: ${JSON.stringify(result.sent)}`)
  })
  .catch((error) => {
    console.error('[jobs] failed:', error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
