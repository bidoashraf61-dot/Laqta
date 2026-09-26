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
import { readFileSync } from 'node:fs'
import { db } from '../lib/db'
import * as legal from '../content/legal'
import type { DocumentSection } from '../components/layout/document-page'

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

/**
 * Claims the copy has made and the product cannot back.
 *
 * The launch catalogue is AI-generated, so "real locations" and "permits
 * cleared" are false about it (specs/public/index.md). A price comparison names
 * a competitor by implication and cannot be substantiated. "Every use" is false
 * while the licence excludes reselling the clip itself.
 */
const OVERCLAIMS: Array<[RegExp, string]> = [
  [/بسعر لقطة (?:مفردة|واحدة)|أرخص ب|cheaper than|\d+\s*(?:×|x|times) cheaper/i, 'compares price'],
  [/مواقع (?:سعودية )?حقيقية|actually shot|real locations/i, 'claims the footage was filmed on location'],
  [/تصاريح موثّقة|permits (?:and locations )?cleared|documented clearance/i, 'claims permits were cleared'],
  [/جميع الاستخدامات|every use\b|all uses\b/i, 'claims the licence covers every use'],
]

type Tree = { [k: string]: string | Tree }
const flatten = (tree: Tree, prefix = ''): Array<[string, string]> =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [[prefix + k, v] as [string, string]] : flatten(v, `${prefix}${k}.`),
  )

const DOCUMENTS: Record<string, DocumentSection[]> = {
  terms: legal.TERMS,
  privacy: legal.PRIVACY,
  licences: legal.LICENCES,
  contentPolicy: legal.CONTENT_POLICY,
  about: legal.ABOUT,
  contact: legal.CONTACT,
}

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

  // DEV-06: studio albums were created with no licence and sold blank.
  console.log('\nNo album and no order item is without a licence')
  const [bareAlbums, bareItems] = await Promise.all([
    db.album.count({ where: { licenceVersionId: null } }),
    db.orderItem.count({ where: { licenceVersionId: null } }),
  ])
  if (bareAlbums > 0) fail(`${bareAlbums} album(s) have no licence — run npm run repair:licences`)
  else console.log('  pass  every album carries a licence')
  if (bareItems > 0) fail(`${bareItems} order item(s) have no licence — run npm run repair:licences`)
  else console.log('  pass  every order item carries a licence')

  // The same promise, made on the page instead of the certificate. These claims
  // were removed from the copy, recorded in specs/public/index.md and
  // specs/glossary.md as banned, and still came back through an editorial
  // pass — twice. A spec note did not hold them; a failing gate does.
  console.log('\nThe site copy makes no claim the product cannot back')
  const copy = [
    ...flatten(JSON.parse(readFileSync('messages/ar.json', 'utf8'))),
    ...flatten(JSON.parse(readFileSync('messages/en.json', 'utf8'))),
    ...Object.entries(DOCUMENTS).flatMap(([id, sections]) =>
      sections.flatMap((s, i) =>
        [s.heading, s.headingEn, ...s.body, ...(s.bodyEn ?? []), ...(s.list ?? []), ...(s.listEn ?? [])]
          .filter((text): text is string => Boolean(text))
          .map((text): [string, string] => [`doc.${id}.${i + 1}`, text]),
      ),
    ),
  ]
  let honest = true
  for (const [key, text] of copy) {
    for (const [pattern, why] of [...CONTRADICTIONS, ...OVERCLAIMS]) {
      if (pattern.test(text)) {
        fail(`${key} ${why}: «${text.slice(0, 80)}»`)
        honest = false
      }
    }
  }
  if (honest) console.log(`  pass  ${copy.length} strings, no banned claim`)

  await db.$disconnect()

  if (failures) {
    console.error(`\n${failures} licence check(s) failed.\n`)
    process.exit(1)
  }
  console.log('\nEvery buyer holds the licence they were sold.\n')
}

main()
