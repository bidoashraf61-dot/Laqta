/**
 * The licence a buyer holds must say what they were sold.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * The product once had Standard and Extended tiers. Collapsing to one
 * commercial licence removed them from the schema and the seed, and left their
 * rows in every existing database — all still flagged `isCurrent`. Orders kept
 * attaching `standard-v1`, whose text caps the buyer at 500,000 views, while
 * every page promised «بلا حد للمشاهدات».
 *
 * Nothing caught it. It is data, not code, so no build fails; it is legal
 * text, so no layout breaks; and it only becomes visible on the licence
 * certificate — a document generated after the sale, which is the worst
 * possible moment to discover it.
 */
import { db } from '../lib/db'

/**
 * Phrasing that only makes sense in a world with more than one licence.
 *
 * A NUMBER is required for the cap patterns. An earlier version matched the
 * bare phrase "view cap" and flagged the correct licence, whose English text
 * reads "with no view cap" — a check that fires on the negation of the thing
 * it is looking for is worse than no check.
 */
const CONTRADICTIONS: Array<[RegExp, string]> = [
  [/بحد أقصى[^.]{0,40}[\d٠-٩]/u, 'caps the number of views'],
  [/(?:up to|maximum of)\s+[\d,.]+\s*(?:million\s*)?views/i, 'caps the number of views'],
  [/الترخيص القياسي|standard licen[cs]e/i, 'names a "standard" tier'],
  [/الترخيص الموسّع|extended licen[cs]e/i, 'names an "extended" tier'],
]

async function main() {
  let failures = 0
  const fail = (message: string) => {
    console.error(`  FAIL  ${message}`)
    failures++
  }

  console.log('\nExactly one licence is current')
  const current = await db.licenceVersion.findMany({
    where: { isCurrent: true },
    select: { version: true, titleAr: true, titleEn: true, bodyAr: true, bodyEn: true },
  })

  if (current.length === 0) fail('no licence is marked current')
  else if (current.length > 1)
    fail(`${current.length} licences are current: ${current.map((r) => r.version).join(', ')}`)
  else console.log(`  pass  ${current[0].version}`)

  console.log('\nThe current licence does not contradict the one-licence promise')
  for (const licence of current) {
    const text = [licence.titleAr, licence.titleEn, licence.bodyAr, licence.bodyEn].join(' ')
    let clean = true
    for (const [pattern, why] of CONTRADICTIONS) {
      if (pattern.test(text)) {
        fail(`${licence.version} ${why}`)
        clean = false
      }
    }
    if (clean) console.log(`  pass  ${licence.version} states an uncapped, single licence`)
  }

  console.log('\nNo order item points at a retired licence')
  const retired = await db.licenceVersion.findMany({
    where: { isCurrent: false },
    select: { id: true, version: true },
  })
  if (retired.length) {
    const stranded = await db.orderItem.count({
      where: { licenceVersionId: { in: retired.map((row) => row.id) } },
    })
    if (stranded > 0) {
      fail(`${stranded} order item(s) hold a retired licence — run scripts/repair-licence-versions.ts`)
    } else {
      console.log(`  pass  ${retired.length} retired version(s), none in use`)
    }
  } else {
    console.log('  pass  nothing retired')
  }

  await db.$disconnect()

  if (failures) {
    console.error(`\n${failures} licence check(s) failed.\n`)
    process.exit(1)
  }
  console.log('\nEvery buyer holds the licence they were sold.\n')
}

main()
