/**
 * Retire the licence tiers that no longer exist.
 *
 * ── What went wrong ─────────────────────────────────────────────────────────
 * The product once had Standard and Extended licences. Collapsing to one
 * commercial licence removed the tiers from the schema and the seed, but left
 * their `LicenceVersion` rows in every existing database — all still flagged
 * `isCurrent`. Orders kept attaching `standard-v1`, whose text reads
 * «بحد أقصى ٥٠٠٬٠٠٠ مشاهدة».
 *
 * So a buyer was sold «بلا حد للمشاهدات» on every page and given a licence
 * record capping them at 500,000 views. The licence certificate surfaced it by
 * printing the contradiction onto the document a buyer hands to a lawyer.
 *
 * ── Why the rows are retired and not deleted ────────────────────────────────
 * `OrderItem.licenceVersionId` points at them. A licence someone holds must
 * stay readable — deleting it would break the very record it exists to prove.
 *
 * ── Why order items ARE repointed ───────────────────────────────────────────
 * The freeze principle protects a buyer from terms changing after they bought.
 * It does not preserve a record that never matched the sale. Every one of
 * these buyers was shown the full commercial licence at checkout and charged
 * for it; repointing corrects an error rather than rewriting an agreement.
 *
 * ── Blank licences (DEV-06) ─────────────────────────────────────────────────
 * Albums created in the studio were given no licence, and checkout copied the
 * album's pointer onto the order — so a creator album sold with a blank
 * licence and a certificate with no terms. Albums and order items with no
 * licence are pointed at the current one, for the same reason as above: the
 * buyer was shown the commercial licence and paid for it.
 *
 * Idempotent. Safe to run more than once.
 */
import { db } from '../lib/db'

const RETIRED = ['standard-v1', 'extended-v1']

async function main() {
  const commercial = await db.licenceVersion.findUnique({ where: { version: 'commercial-v1' } })
  if (!commercial) {
    console.error('commercial-v1 is missing. Run `npm run db:seed` first.')
    process.exit(1)
  }

  const stale = await db.licenceVersion.findMany({
    where: { version: { in: RETIRED } },
    select: { id: true, version: true },
  })

  if (stale.length) {
    const moved = await db.orderItem.updateMany({
      where: { licenceVersionId: { in: stale.map((row) => row.id) } },
      data: { licenceVersionId: commercial.id },
    })
    console.log(`repointed ${moved.count} order item(s) to commercial-v1`)

    const retired = await db.licenceVersion.updateMany({
      where: { version: { in: RETIRED } },
      data: { isCurrent: false },
    })
    console.log(`retired ${retired.count} licence version(s): ${stale.map((r) => r.version).join(', ')}`)
  } else {
    console.log('no retired tiers present')
  }

  // Exactly one current licence, whatever else is in the table.
  await db.licenceVersion.updateMany({
    where: { version: { not: 'commercial-v1' } },
    data: { isCurrent: false },
  })
  await db.licenceVersion.update({ where: { id: commercial.id }, data: { isCurrent: true } })

  // Blank licences: albums from the studio, and anything sold from them.
  const albums = await db.album.updateMany({
    where: { licenceVersionId: null },
    data: { licenceVersionId: commercial.id },
  })
  console.log(`gave ${albums.count} album(s) with no licence the commercial licence`)
  const blankItems = await db.orderItem.updateMany({
    where: { licenceVersionId: null },
    data: { licenceVersionId: commercial.id },
  })
  console.log(`gave ${blankItems.count} order item(s) with no licence the commercial licence`)

  // Certificates printed from a retired or blank licence carry the wrong terms
  // and must be rebuilt. Clearing the key is enough: the route regenerates on demand.
  const cleared = await db.licenceCertificate.updateMany({
    where: { pdfKey: { not: null } },
    data: { pdfKey: null },
  })
  console.log(`cleared ${cleared.count} stale certificate PDF(s) for regeneration`)

  const current = await db.licenceVersion.findMany({
    where: { isCurrent: true },
    select: { version: true },
  })
  console.log('current:', current.map((row) => row.version).join(', '))
  await db.$disconnect()
}

main()
