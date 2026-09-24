/**
 * A database built from prisma/migrations must be the database schema.prisma
 * describes.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * For most of the build the schema moved with `prisma db push`. Every page
 * worked, every gate passed, and prisma/migrations fell a whole product behind:
 * no reviews, no footage requests, no mail outbox, licence tiers still present,
 * SAR still the default currency. The development database never noticed
 * because `db push` had already given it the final shape. The first database
 * to notice would have been production, on the first `prisma migrate deploy`.
 *
 * So this replays every migration into a throwaway database and diffs the
 * result against schema.prisma. Any difference fails the gate. The fix is a
 * new migration, never an edit to one that has already shipped.
 */
import { spawnSync } from 'node:child_process'

// Prisma reads .env for itself; this script needs the URL before Prisma runs.
// Node's own loader, so the gate adds no dependency. It never overrides a
// variable already set in the environment.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env — DATABASE_URL must come from the environment.
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

// Named per run so two sessions checking at once never share a shadow.
const shadowName = `laqta_migrations_check_${process.pid}`
const shadow = new URL(url)
shadow.pathname = `/${shadowName}`

function prisma(args: string[], stdin?: string) {
  return spawnSync('npx', ['prisma', ...args], { input: stdin, encoding: 'utf8' })
}

function execute(sql: string) {
  const result = prisma(['db', 'execute', '--url', url!, '--stdin'], sql)
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
}

console.log('Migrations\n')

execute(`CREATE DATABASE "${shadowName}";`)
let status = 1
try {
  const diff = prisma([
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--shadow-database-url',
    shadow.toString(),
    '--exit-code',
  ])
  // --exit-code: 0 = identical, 2 = different, anything else = could not diff.
  status = diff.status ?? 1
  const report = diff.stdout
    .split('\n')
    .filter((line) => !/^warn|pris\.ly/.test(line))
    .join('\n')
    .trim()

  if (status === 0) {
    console.log('  pass  replaying prisma/migrations produces schema.prisma exactly')
  } else if (status === 2) {
    console.error('  FAIL  prisma/migrations does not produce schema.prisma:\n')
    console.error(report.replace(/^/gm, '        '))
    console.error('\n  Add a migration (prisma migrate diff ... --script); never edit a shipped one.')
  } else {
    console.error('  FAIL  could not replay the migrations:\n')
    console.error((diff.stderr || report).replace(/^/gm, '        '))
  }
} finally {
  execute(`DROP DATABASE IF EXISTS "${shadowName}";`)
}

if (status !== 0) {
  console.error('\nMigrations have drifted from the schema.\n')
  process.exit(1)
}
console.log('\nA fresh database gets the schema the app is built against.\n')
