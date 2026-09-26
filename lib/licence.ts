import { db } from '@/lib/db'

/**
 * The licence in force now — the one every album is sold under.
 *
 * There is ONE licence (full commercial), versioned. Albums point at it so the
 * album page can show its text, and every OrderItem freezes the version that
 * was current at purchase. Null means the database has no current licence,
 * which is a setup error: callers refuse to sell or approve rather than
 * attach a blank licence (DEV-06 — studio albums were created with none, and
 * a purchase copied that blank onto the order and the certificate).
 */
export async function currentLicenceId() {
  const licence = await db.licenceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  })
  return licence?.id ?? null
}
