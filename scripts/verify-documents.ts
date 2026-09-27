/**
 * The long-form pages the owner edits from /admin/content (DEV-64a).
 *
 *   npm run verify:documents        (no server needed)
 *
 * What this protects:
 *   - the text in content/legal.ts is a valid default for every page, and is
 *     what a page shows when nothing is published;
 *   - publishing refuses what would break or embarrass a page: no Arabic
 *     heading, an empty section, HTML, Arabic pasted into an English box, a
 *     list on the contact guide, and every banned claim verify:licence knows;
 *   - a published version is what the page shows, with its publish date as the
 *     date the page took effect;
 *   - a restore publishes a NEW version and deletes nothing — to an earlier
 *     version or to the original text;
 *   - a stored version that no longer validates falls back to the original
 *     text instead of breaking the page;
 *   - publish and restore are audited.
 *
 * Every row this creates is deleted at the end, so the pages are left as they
 * were — including any version the owner published before the run.
 */
import { db } from '../lib/db'
import {
  CODE_DEFAULT,
  DOCUMENT_KEYS,
  DOCUMENTS,
  loadDocument,
  normaliseSections,
  publishDocument,
  restoreDocument,
  validateSections,
} from '../lib/editable-documents'
import { EFFECTIVE_FROM } from '../content/legal'
import type { DocumentSection } from '../components/layout/document-page'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const good: DocumentSection[] = [
  {
    heading: 'قسم تجريبي',
    headingEn: 'A test section',
    body: ['فقرة أولى.', 'فقرة ثانية.'],
    bodyEn: ['First paragraph.', 'Second paragraph.'],
    list: ['بند'],
    listEn: ['Item'],
  },
]

async function main() {
  console.log('Editable long-form pages\n')

  // ── The defaults ─────────────────────────────────────────────────────────
  for (const key of DOCUMENT_KEYS) {
    const error = validateSections(key, normaliseSections(DOCUMENTS[key].defaults))
    report(`the original ${key} text passes the publish rules`, error === null, error?.key)
  }

  // ── The rules, on plain values ───────────────────────────────────────────
  const refuses = (label: string, key: (typeof DOCUMENT_KEYS)[number], sections: unknown, expected: string) => {
    const error = validateSections(key, normaliseSections(sections))
    report(`refuses ${label}`, error?.key === `dash.docs.error.${expected}`, error?.key ?? 'accepted')
  }
  refuses('a page with no sections', 'terms', [], 'empty')
  refuses('a section with no Arabic heading', 'terms', [{ ...good[0], heading: '  ' }], 'heading')
  refuses('a section with no Arabic text', 'terms', [{ heading: 'عنوان', body: ['', ' '] }], 'body')
  refuses('HTML', 'terms', [{ ...good[0], body: ['نص <script>x</script>'] }], 'markup')
  refuses('Arabic in an English field', 'terms', [{ ...good[0], bodyEn: ['هذا نص عربي كامل'] }], 'arabicInEnglish')
  refuses('a list on the contact guide', 'contact', good, 'noLists')
  refuses('a banned claim (Arabic)', 'licences', [{ ...good[0], body: ['يغطي جميع الاستخدامات.'] }], 'claim')
  refuses('a banned claim (English)', 'about', [{ ...good[0], bodyEn: ['Shot in real locations.'] }], 'claim')
  refuses('a paragraph over the limit', 'terms', [{ ...good[0], body: ['ا'.repeat(3001)] }], 'paragraphLong')
  report(
    'accepts Arabic quoted inside English',
    validateSections('about', normaliseSections([{ ...good[0], bodyEn: ['Search finds «العلا» and AlUla alike.'] }])) === null,
  )
  report(
    'reports the failing section by number',
    validateSections('terms', normaliseSections([good[0], { heading: '', body: ['x'] }]))?.section === 2,
  )

  // ── Against the database ─────────────────────────────────────────────────
  const key = 'privacy' as const
  const admin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
  if (!admin) throw new Error('need an admin — npm run db:seed')
  const before = await db.documentVersion.findMany({ where: { docKey: key }, select: { id: true } })
  const created: string[] = []

  try {
    // Only checkable when the owner has not published this page yet.
    if (before.length === 0) {
      const shown = await loadDocument(key)
      report(
        'nothing published → the original text, dated from content/legal.ts',
        shown.versionId === null && shown.sections === DOCUMENTS[key].defaults && shown.effectiveFrom?.getTime() === EFFECTIVE_FROM.getTime(),
      )
    }

    const refused = await publishDocument({ key, sections: [{ heading: '', body: ['x'] }], note: '', actorId: admin.id })
    report('a refused publish writes nothing', !refused.ok && (await db.documentVersion.count({ where: { docKey: key } })) === before.length)

    const first = await publishDocument({ key, sections: good, note: 'verify:documents', actorId: admin.id })
    report('a valid publish succeeds', first.ok)
    if (!first.ok) throw new Error('publish failed')
    created.push(first.versionId)
    const row = await db.documentVersion.findUniqueOrThrow({ where: { id: first.versionId } })
    report('the version stores the normalised sections', JSON.stringify(normaliseSections(row.sections)) === JSON.stringify(normaliseSections(good)))
    report('the version records who and why', row.publishedById === admin.id && row.note === 'verify:documents')
    report(
      'the publish is audited',
      (await db.auditLog.count({ where: { action: 'document.publish', entityId: first.versionId } })) === 1,
    )

    // `loadDocument` is React-cached per render; outside a render each call is fresh.
    const shown = await loadDocument(key)
    report('the page shows the published version', shown.versionId === first.versionId && shown.sections[0].heading === 'قسم تجريبي')
    report('the page is dated from the publish', shown.effectiveFrom?.getTime() === row.publishedAt.getTime())

    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await publishDocument({
      key,
      sections: [{ ...good[0], heading: 'نسخة ثانية' }],
      note: '',
      actorId: admin.id,
    })
    if (!second.ok) throw new Error('second publish failed')
    created.push(second.versionId)
    report('the newest version wins', (await loadDocument(key)).versionId === second.versionId)

    await new Promise((resolve) => setTimeout(resolve, 5))
    const restored = await restoreDocument({ key, from: first.versionId, actorId: admin.id })
    if (!restored.ok) throw new Error('restore failed')
    created.push(restored.versionId)
    const afterRestore = await loadDocument(key)
    report(
      'a restore publishes a new copy of the old version',
      afterRestore.versionId === restored.versionId && afterRestore.sections[0].heading === 'قسم تجريبي',
    )
    report(
      'a restore deletes nothing',
      (await db.documentVersion.count({ where: { id: { in: [first.versionId, second.versionId] } } })) === 2,
    )
    report(
      'a restore records where it came from and is audited',
      (await db.documentVersion.findUniqueOrThrow({ where: { id: restored.versionId } })).restoredFromId === first.versionId &&
        (await db.auditLog.count({ where: { action: 'document.restore', entityId: restored.versionId } })) === 1,
    )

    await new Promise((resolve) => setTimeout(resolve, 5))
    const original = await restoreDocument({ key, from: CODE_DEFAULT, actorId: admin.id })
    if (!original.ok) throw new Error('restore to original failed')
    created.push(original.versionId)
    report(
      'restoring the original text publishes it as a version',
      JSON.stringify((await loadDocument(key)).sections) === JSON.stringify(normaliseSections(DOCUMENTS[key].defaults)),
    )

    report(
      'a restore from another page is refused',
      !(await restoreDocument({ key: 'terms', from: first.versionId, actorId: admin.id })).ok,
    )

    await new Promise((resolve) => setTimeout(resolve, 5))
    const broken = await db.documentVersion.create({
      data: { docKey: key, sections: [{ heading: '', body: [] }], publishedById: admin.id },
    })
    created.push(broken.id)
    const fallback = await loadDocument(key)
    report('a stored version that no longer validates shows the original text', fallback.versionId === null && fallback.sections === DOCUMENTS[key].defaults)
  } finally {
    await db.auditLog.deleteMany({ where: { entity: 'DocumentVersion', entityId: { in: created } } })
    await db.documentVersion.deleteMany({ where: { id: { in: created } } })
    await db.$disconnect()
  }

  console.log(failures ? `\n${failures} check(s) failed.\n` : '\nThe long-form pages publish, restore and fall back safely.\n')
  process.exit(failures ? 1 : 0)
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
