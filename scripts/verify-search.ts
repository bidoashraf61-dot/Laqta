/**
 * Arabic search behaviour.
 *
 *   npx tsx scripts/verify-search.ts
 *
 * The brief's hardest requirement is that search works the way Arabic actually
 * gets typed — not the way it appears in a dictionary. Each case below is a
 * real way a buyer would enter the same intent.
 */
import { search, logSearch } from '../lib/search'
import { db } from '../lib/db'

let failures = 0
function report(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function count(q: string) {
  const result = await search({ q })
  return result.total
}

async function main() {
  console.log('Arabic search\n')

  const baseline = await count('العلا')
  report('Arabic place name returns footage', baseline > 0, `${baseline} clips`)

  // The cross-language hop: the catalogue is tagged العلا, the buyer typed
  // English. This only works because the taxonomy carries transliterations.
  const english = await count('AlUla')
  report('English transliteration finds Arabic-tagged footage', english > 0, `${english} clips`)
  report('both spellings agree', english === baseline, `${english} vs ${baseline}`)

  // Real spelling variants people type.
  for (const variant of ['العلى', 'Al-Ula', 'Hegra', 'Madain Saleh']) {
    const n = await count(variant)
    report(`variant "${variant}" resolves`, n > 0, `${n} clips`)
  }

  // Diacritics and tatweel are optional in writing and must not change results.
  // Deliberately tested against a term that HAS live hits — comparing 0 to 0
  // passes without proving anything.
  const stretched = await count('العـــلا')
  report(
    'tatweel is ignored',
    stretched === baseline && baseline > 0,
    `${stretched} vs ${baseline}`,
  )
  const diacritics = await count('العَلا')
  report(
    'diacritics are ignored',
    diacritics === baseline && baseline > 0,
    `${diacritics} vs ${baseline}`,
  )

  // Filters
  const cleared = await search({ clearedForCommercial: true })
  const all = await search({})
  report(
    'cleared-for-commercial filter narrows the set',
    cleared.total > 0 && cleared.total <= all.total,
    `${cleared.total} of ${all.total}`,
  )

  const fourK = await search({ minWidth: 3840 })
  report('resolution filter applies', fourK.total > 0 && fourK.total <= all.total, `${fourK.total} clips`)

  const vertical = await search({ aspectRatio: '9:16' })
  report('vertical filter runs (0 hits is valid on this seed)', vertical.total >= 0)

  // Every hit must carry the album ribbon — the rule the whole brief exists for.
  const sample = await search({ perPage: 60 })
  const missingRibbon = sample.hits.filter(
    (hit) => !hit.album?.slug || !hit.album.priceStandard || !hit.album.creatorHandle,
  )
  report(
    'every clip carries its album, price and route',
    missingRibbon.length === 0,
    missingRibbon.length ? `${missingRibbon.length} missing` : `${sample.hits.length} checked`,
  )

  // Masters must never be reachable from a catalogue query.
  const leaked = sample.hits.filter((hit) => 'masterKey' in (hit as Record<string, unknown>))
  report('no master key in any search hit', leaked.length === 0)

  // Only live albums are searchable.
  const draftClip = await db.clip.findFirst({
    where: { album: { status: 'draft' } },
    select: { titleAr: true },
  })
  if (draftClip) {
    const hits = await search({ q: draftClip.titleAr })
    const foundDraft = hits.hits.some((hit) => hit.titleAr === draftClip.titleAr)
    report('draft albums are not searchable', !foundDraft, draftClip.titleAr)
  }

  // Zero-result logging — the content-acquisition roadmap.
  const before = await db.searchQueryLog.count()
  const nonsense = 'لقطات لمدينة لا وجود لها إطلاقاً'
  const zero = await count(nonsense)
  await logSearch({ q: nonsense }, zero)
  const after = await db.searchQueryLog.count()
  report('zero-result query returns nothing', zero === 0)
  report('and is logged for the demand report', after === before + 1)

  await db.searchQueryLog.deleteMany({ where: { query: nonsense } })

  console.log(failures === 0 ? '\nAll search checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
