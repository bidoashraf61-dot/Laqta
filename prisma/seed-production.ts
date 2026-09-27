/**
 * Laqta PRODUCTION seed (DEV-47).
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run db:seed:production
 *
 * Puts in only what a real Laqta needs before the first creator signs up:
 *   · the Saudi taxonomy (locations, categories, themes, tags) with the
 *     search synonyms (prisma/seed-base.ts)
 *   · the one current licence, commercial-v1
 *   · the suggested-price bands
 *   · ONE admin account — the owner's — from ADMIN_EMAIL / ADMIN_PASSWORD
 *
 * And nothing else: no demo albums, clips, orders, reviews, ratings, view
 * counts, collections or creators. Albums arrive through the studio.
 *
 * Safe to re-run: every write is an upsert, nothing is deleted, and an admin
 * that already exists keeps its password (set ADMIN_RESET_PASSWORD=1 to
 * replace it). The password is never printed.
 *
 * Refuses a database that holds the demo seed's accounts — demo data in a
 * real database has to be removed deliberately, not seeded over.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { DEMO_EMAILS, seedLicences, seedPriceBands, seedTaxonomy } from './seed-base'

try {
  process.loadEnvFile('.env')
} catch {
  // No .env — the variables come from the environment.
}

const db = new PrismaClient()
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD ?? ''
  const name = (process.env.ADMIN_NAME ?? '').trim() || 'مدير لقطة'

  if (!EMAIL.test(email)) fail('Set ADMIN_EMAIL to the owner\'s email address.')
  if (DEMO_EMAILS.includes(email)) fail('ADMIN_EMAIL is a demo address. Use the owner\'s real email.')
  if (password.length < 12) fail('Set ADMIN_PASSWORD to at least 12 characters (it is never printed).')
  if (password === 'Laqta!2026') fail('That is the published demo password. Choose another.')

  const demo = await db.user.count({ where: { email: { in: DEMO_EMAILS } } })
  if (demo > 0) {
    fail(
      'This database holds the demo seed\'s accounts, so it is not a clean production database.\n' +
        'Point DATABASE_URL at the production database (or remove the demo data deliberately first).',
    )
  }

  console.log('Seeding Laqta for production…')
  await seedTaxonomy(db)
  await seedLicences(db)
  await seedPriceBands(db)

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  const resetPassword = process.env.ADMIN_RESET_PASSWORD === '1'
  const passwordHash = !existing || resetPassword ? await bcrypt.hash(password, 12) : undefined
  await db.user.upsert({
    where: { email },
    update: { role: 'admin', status: 'active', ...(passwordHash ? { passwordHash } : {}) },
    create: {
      email,
      name,
      role: 'admin',
      locale: 'ar',
      // The owner's own address, typed by the owner at seed time.
      emailVerified: new Date(),
      passwordHash: passwordHash!,
      // 2FA is enrolled by the owner at /account/security after first sign-in,
      // so the authenticator and the database share a real secret.
      twoFactorEnabled: false,
    },
  })
  console.log(
    `  admin — ${email} ${existing ? (resetPassword ? '(existed; password replaced)' : '(existed; password unchanged)') : '(created)'}`,
  )

  const [albums, users] = await Promise.all([db.album.count(), db.user.count()])
  console.log(`\nDone. ${users} account(s), ${albums} album(s).`)
  console.log('Next: sign in at /sign-in, then turn on two-step sign-in at /account/security.')
}

function fail(message: string): never {
  console.error(`Refusing: ${message}`)
  process.exit(1)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
