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
import { CONTRADICTIONS, OVERCLAIMS } from '../lib/copy-claims'
import { DOCUMENT_KEYS, normaliseSections } from '../lib/editable-documents'

type Tree = { [k: string]: string | Tree }
const flatten = (tree: Tree, prefix = ''): Array<[string, string]> =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [[prefix + k, v] as [string, string]] : flatten(v, `${prefix}${k}.`),
  )

// The code defaults; the published versions from /admin/content are added in main().
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
  // DEV-64a: what the site actually shows may be a version the owner published
  // from /admin/content. Publishing refuses these claims already; this is the
  // net under that, and it catches a pattern added here after a publish.
  for (const key of DOCUMENT_KEYS) {
    const latest = await db.documentVersion.findFirst({ where: { docKey: key }, orderBy: { publishedAt: 'desc' } })
    if (!latest) continue
    normaliseSections(latest.sections).forEach((s, i) => {
      for (const text of [s.heading, s.headingEn, ...s.body, ...(s.bodyEn ?? []), ...(s.list ?? []), ...(s.listEn ?? [])]) {
        if (text) copy.push([`published.${key}.${i + 1}`, text])
      }
    })
  }

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
