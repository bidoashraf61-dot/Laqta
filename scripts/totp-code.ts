/**
 * Print the current two-factor code for a local account.
 *
 *   npm run totp:code -- admin@laqta.sa
 *
 * Two-factor is mandatory for admin and creator accounts (lib/two-factor.ts),
 * so signing in to the local demo admin or creator asks for a 6-digit code.
 * This reads the account's secret from the LOCAL database and prints the code
 * an authenticator app would show right now. Refuses to run in production.
 */
import { db } from '../lib/db'
import { generateToken } from '../lib/totp'

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refused: totp:code is for the local development database only.')
    process.exit(1)
  }
  const email = (process.argv[2] ?? '').toLowerCase()
  if (!email) {
    console.error('Usage: npm run totp:code -- <email>')
    process.exit(1)
  }
  const user = await db.user.findUnique({
    where: { email },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  })
  if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
    console.error(`${email} has no two-factor enrolled.`)
    process.exit(1)
  }
  const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30)
  console.log(`${generateToken(user.twoFactorSecret)}  (${email}, valid ~${secondsLeft}s)`)
}

main().finally(() => db.$disconnect())
