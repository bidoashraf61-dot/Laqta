/**
 * The production seed gives a real database what it needs and nothing fake
 * (DEV-47).
 *
 *   npm run verify:production-seed        (needs the local Postgres; no server)
 *
 * Replays every migration into a throwaway database, runs
 * `prisma/seed-production.ts` against it TWICE, and checks:
 *   - the real data is there: taxonomy of every kind, exactly one current
 *     licence, the four price bands;
 *   - exactly one account, the admin from ADMIN_EMAIL, with the password
 *     hashed (never the demo password) and 2FA left for the owner to enrol;
 *   - nothing demo: no albums, clips, orders, reviews, analytics rows,
 *     collections, creators, promo codes or bundles;
 *   - the second run changed nothing (idempotent);
 *   - the seed refuses a weak password, a demo email, and a database holding
 *     the demo accounts;
 *   - the DEMO seed refuses a non-local database.
 * The throwaway database is dropped at the end.
 */
import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { demoSeedAllowed } from '../prisma/seed-base'

try {
  process.loadEnvFile('.env')
} catch {
  // DATABASE_URL must come from the environment.
}
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const name = `laqta_prodseed_check_${process.pid}`
const target = new URL(url)
target.pathname = `/${name}`
const ADMIN = 'owner@laqta.test'
const PASSWORD = `verify-${process.pid}-Production!`

function run(cmd: string, args: string[], env: Record<string, string>, input?: string) {
  return spawnSync(cmd, args, { encoding: 'utf8', input, env: { ...process.env, ...env } })
}
const execute = (sql: string) => {
  const result = run('npx', ['prisma', 'db', 'execute', '--url', url, '--stdin'], {}, sql)
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
}
const seed = (env: Record<string, string>) =>
  run('npx', ['tsx', 'prisma/seed-production.ts'], { DATABASE_URL: target.toString(), ...env })

async function counts(db: PrismaClient) {
  const [taxonomy, licences, current, bands, users, albums, clips, orders, reviews, analytics, searches, collections, creators, promos, bundles] =
    await Promise.all([
      db.taxonomy.groupBy({ by: ['kind'], _count: { _all: true } }),
      db.licenceVersion.count(),
      db.licenceVersion.count({ where: { isCurrent: true } }),
      db.priceBand.count(),
      db.user.count(),
      db.album.count(),
      db.clip.count(),
      db.order.count(),
      db.albumReview.count(),
      db.albumStat.count(),
      db.searchQueryLog.count(),
      db.collection.count(),
      db.creator.count(),
      db.promoCode.count(),
      db.bundle.count(),
    ])
  return {
    taxonomy: Object.fromEntries(taxonomy.map((row: { kind: string; _count: { _all: number } }) => [row.kind, row._count._all])),
    licences, current, bands, users, albums, clips, orders, reviews, analytics, searches, collections, creators, promos, bundles,
  }
}

async function main() {
  console.log('Production seed\n')

  report('the demo seed refuses a remote database', !demoSeedAllowed('postgresql://u:p@db.example.com:5432/laqta', {}))
  report('the demo seed allows the local one', demoSeedAllowed('postgresql://u:p@localhost:5433/laqta', {}))
  const demoRemote = run('npx', ['tsx', 'prisma/seed.ts'], { DATABASE_URL: 'postgresql://u:p@db.example.com:5432/laqta', SEED_DEMO: '' })
  report('running the demo seed at a remote database exits before writing', demoRemote.status === 1 && /Refusing/.test(demoRemote.stderr))

  execute(`CREATE DATABASE "${name}";`)
  const db = new PrismaClient({ datasourceUrl: target.toString() })
  try {
    const migrate = run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: target.toString() })
    if (migrate.status !== 0) throw new Error(migrate.stderr || migrate.stdout)

    report('refuses a short password', seed({ ADMIN_EMAIL: ADMIN, ADMIN_PASSWORD: 'short' }).status === 1)
    report('refuses the demo password', seed({ ADMIN_EMAIL: ADMIN, ADMIN_PASSWORD: 'Laqta!2026' }).status === 1)
    report('refuses a demo email', seed({ ADMIN_EMAIL: 'admin@laqta.sa', ADMIN_PASSWORD: PASSWORD }).status === 1)

    const first = seed({ ADMIN_EMAIL: ADMIN, ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: 'Owner' })
    report('a valid run succeeds', first.status === 0, first.status === 0 ? '' : first.stderr.slice(0, 200))
    report('the password is never printed', !first.stdout.includes(PASSWORD) && !first.stderr.includes(PASSWORD))
    const after = await counts(db)

    report(
      'taxonomy of every kind',
      ['location', 'category', 'theme', 'tag'].every((kind) => (after.taxonomy[kind] ?? 0) > 0),
      JSON.stringify(after.taxonomy),
    )
    report('exactly one licence, and it is current', after.licences === 1 && after.current === 1)
    report('the four price bands', after.bands === 4)

    const admin = await db.user.findUnique({ where: { email: ADMIN } })
    report('exactly one account — the admin', after.users === 1 && admin?.role === 'admin')
    report(
      'its password is hashed, and 2FA is left to the owner',
      Boolean(admin?.passwordHash && (await bcrypt.compare(PASSWORD, admin.passwordHash))) && admin?.twoFactorEnabled === false,
    )
    const fake = { albums: after.albums, clips: after.clips, orders: after.orders, reviews: after.reviews, analytics: after.analytics, searches: after.searches, collections: after.collections, creators: after.creators, promos: after.promos, bundles: after.bundles }
    report('nothing demo: no albums, clips, orders, reviews, stats, search logs, collections, creators, promos, bundles', Object.values(fake).every((n) => n === 0), JSON.stringify(fake))

    const second = seed({ ADMIN_EMAIL: ADMIN, ADMIN_PASSWORD: 'a-different-password-123' })
    const again = await counts(db)
    const unchanged = await db.user.findUnique({ where: { email: ADMIN } })
    report('a second run changes nothing', second.status === 0 && JSON.stringify(again) === JSON.stringify(after))
    report(
      'a second run keeps the admin\'s password',
      Boolean(unchanged?.passwordHash && (await bcrypt.compare(PASSWORD, unchanged.passwordHash))),
    )

    await db.user.create({ data: { email: 'buyer@agency.sa', passwordHash: 'x' } })
    const onDemo = seed({ ADMIN_EMAIL: ADMIN, ADMIN_PASSWORD: PASSWORD })
    report('refuses a database holding demo accounts', onDemo.status === 1 && /demo/.test(onDemo.stderr))
  } finally {
    await db.$disconnect()
    execute(`DROP DATABASE IF EXISTS "${name}";`)
  }

  console.log(failures ? `\n${failures} production-seed check(s) failed.\n` : '\nA real database gets real data only.\n')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  try {
    execute(`DROP DATABASE IF EXISTS "${name}";`)
  } catch {
    // Best effort.
  }
  process.exit(1)
})
