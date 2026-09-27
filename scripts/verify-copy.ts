/**
 * The site copy the owner edits from /admin/content/copy (DEV-64b).
 *
 *   npm run verify:copy        (no server needed)
 *
 * What this protects:
 *   - every original string of the landing page, /sell and the emails passes
 *     the edit rules, in both languages — so the rules never refuse the text
 *     the site was built with;
 *   - an edit cannot drop or invent a `{placeholder}`, overrun its length cap,
 *     carry HTML, put Arabic in an English box (or no Arabic in an Arabic
 *     one), or make a banned claim (licence, refunds, first/largest, and for
 *     mail "filmed");
 *   - a publish is one batch: refused whole or written whole, revision rows
 *     for every string, audited, and `translate()` shows it at once;
 *   - an empty edit, or one equal to the original, removes the override;
 *   - undo puts every string of a batch back, as a new batch;
 *   - a preview stores validated drafts only, and a bad id loads nothing;
 *   - every override already published still passes the rules.
 *
 * Any override that existed for the keys under test is put back at the end.
 */
import { db } from '../lib/db'
import { refreshCopyOverrides, publishCopy, undoCopyBatch, saveCopyPreview, loadCopyPreview } from '../lib/copy-overrides'
import { COPY_GROUP_KEYS, defaultCopy, groupKeys, isEditableKey, lengthCap, placeholders, validateCopy } from '../lib/copy-rules'
import { translate } from '../lib/i18n'
import { isLocale, type Locale } from '../lib/locale'

let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('Editable site copy\n')

  // ── The originals pass ───────────────────────────────────────────────────
  for (const group of COPY_GROUP_KEYS) {
    const keys = groupKeys(group)
    const broken = keys.flatMap((key) =>
      (['ar', 'en'] as Locale[]).flatMap((locale) => {
        const error = validateCopy(locale, key, defaultCopy(locale, key))
        return error ? [`${locale}:${key} ${error.key}`] : []
      }),
    )
    report(`the ${keys.length} original ${group} strings pass the edit rules`, broken.length === 0, broken.slice(0, 3).join('; '))
  }
  report('only landing, sell and email are editable', !isEditableKey('dash.settings') && !isEditableKey('checkout.pay') && isEditableKey('landing.heroBold'))

  // ── The rules, on plain values ───────────────────────────────────────────
  const withVars = groupKeys('email').find((key) => placeholders(defaultCopy('ar', key)).length > 0)!
  const original = defaultCopy('ar', withVars)
  const name = placeholders(original)[0]
  const refuses = (label: string, locale: Locale, key: string, value: string, expected: string) => {
    const error = validateCopy(locale, key, value)
    report(`refuses ${label}`, error?.key === `dash.copy.error.${expected}`, error?.key ?? 'accepted')
  }
  refuses('a dropped placeholder', 'ar', withVars, original.replace(`{${name}}`, ''), 'placeholderMissing')
  refuses('an invented placeholder', 'ar', withVars, `${original} {nope}`, 'placeholderExtra')
  refuses('text over the cap', 'ar', 'landing.heroBold', 'ا'.repeat(lengthCap('ar', 'landing.heroBold') + 1), 'tooLong')
  refuses('HTML', 'en', 'landing.heroBold', 'and so is <b>yours</b>.', 'markup')
  refuses('Arabic in an English box', 'en', 'landing.heroBold', 'ولقطاتك سعودية', 'arabicInEnglish')
  refuses('no Arabic in an Arabic box', 'ar', 'landing.heroBold', 'and so is yours.', 'englishInArabic')
  refuses('a first/largest claim', 'en', 'landing.heroBold', 'The largest Saudi library.', 'claim')
  refuses('refund copy', 'ar', 'sell.lead', 'استرداد كامل خلال أسبوع.', 'claim')
  refuses('a licence overclaim', 'en', 'landing.heroBody', 'Covers every use you can think of.', 'claim')
  refuses('"filmed" in an email', 'en', 'email.orderConfirmedHeading', 'Filmed for you.', 'claim')
  report('accepts Latin runs inside Arabic', validateCopy('ar', 'landing.heroBold', 'بدقة 4K ولقطات سعودية.') === null)

  // ── Against the database ─────────────────────────────────────────────────
  const admin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
  if (!admin) throw new Error('need an admin — npm run db:seed')
  const keys = ['landing.heroBold', 'sell.lead']
  const saved = await db.copyOverride.findMany({ where: { key: { in: keys } } })
  const batches: string[] = []
  const previews: string[] = []

  try {
    await db.copyOverride.deleteMany({ where: { key: { in: keys } } })
    await refreshCopyOverrides(true)
    report('no override → translate() reads the JSON', translate('ar', 'landing.heroBold') === defaultCopy('ar', 'landing.heroBold'))

    const refused = await publishCopy({
      changes: [
        { key: 'landing.heroBold', locale: 'ar', value: 'نص مقبول.' },
        { key: 'sell.lead', locale: 'en', value: '<i>no</i>' },
      ],
      actorId: admin.id,
    })
    report(
      'a batch with one bad string writes nothing, and names it',
      !refused.ok && refused.error.at?.key === 'sell.lead' && (await db.copyOverride.count({ where: { key: { in: keys } } })) === 0,
    )

    const first = await publishCopy({
      changes: [
        { key: 'landing.heroBold', locale: 'ar', value: 'ولقطاتك سعودية أيضاً.' },
        { key: 'sell.lead', locale: 'en', value: 'Sell your Saudi footage here.' },
      ],
      note: 'verify:copy',
      actorId: admin.id,
    })
    if (!first.ok) throw new Error(`publish failed: ${JSON.stringify(first.error)}`)
    batches.push(first.batchId)
    report('a publish writes both strings', first.changed === 2 && (await db.copyOverride.count({ where: { key: { in: keys } } })) === 2)
    report('translate() shows the edit at once', translate('ar', 'landing.heroBold') === 'ولقطاتك سعودية أيضاً.')
    report('the other language is untouched', translate('en', 'landing.heroBold') === defaultCopy('en', 'landing.heroBold'))
    report(
      'the publish is recorded and audited',
      (await db.copyRevision.count({ where: { batchId: first.batchId, note: 'verify:copy' } })) === 2 &&
        (await db.auditLog.count({ where: { action: 'copy.publish', entityId: first.batchId } })) === 1,
    )

    const same = await publishCopy({ changes: [{ key: 'landing.heroBold', locale: 'ar', value: 'ولقطاتك سعودية أيضاً.' }], actorId: admin.id })
    report('publishing an unchanged string is refused as "nothing"', !same.ok && same.error.key === 'dash.copy.error.nothing')

    const reset = await publishCopy({ changes: [{ key: 'landing.heroBold', locale: 'ar', value: '' }], actorId: admin.id })
    if (reset.ok) batches.push(reset.batchId)
    report(
      'an empty edit removes the override',
      reset.ok && (await db.copyOverride.count({ where: { key: 'landing.heroBold', locale: 'ar' } })) === 0 &&
        translate('ar', 'landing.heroBold') === defaultCopy('ar', 'landing.heroBold'),
    )

    const undone = await undoCopyBatch({ batchId: first.batchId, actorId: admin.id })
    if (undone.ok) batches.push(undone.batchId)
    report(
      'undo puts the batch back as a new batch',
      undone.ok && (await db.copyOverride.count({ where: { key: 'sell.lead', locale: 'en' } })) === 0 &&
        (await db.copyRevision.count({ where: { batchId: first.batchId } })) === 2 &&
        (await db.auditLog.count({ where: { action: 'copy.restore', entityId: undone.ok ? undone.batchId : '' } })) === 1,
    )

    const bad = await saveCopyPreview({ values: [{ key: 'landing.heroBold', locale: 'en', value: 'عربي فقط هنا' }], actorId: admin.id })
    report('a preview refuses a string the publish would refuse', !bad.ok)
    const good = await saveCopyPreview({ values: [{ key: 'landing.heroBold', locale: 'ar', value: 'معاينة فقط.' }], actorId: admin.id })
    if (good.ok) previews.push(good.id)
    const loaded = good.ok ? await loadCopyPreview(good.id) : null
    report('a preview stores its drafts', loaded?.['ar:landing.heroBold'] === 'معاينة فقط.')
    report('a preview does not publish', translate('ar', 'landing.heroBold') === defaultCopy('ar', 'landing.heroBold'))
    report('an unknown preview id loads nothing', (await loadCopyPreview('nothing-here-at-all')) === null && (await loadCopyPreview('../x')) === null)
    report(
      'an explicit map (a client component) wins over the published copy',
      translate('ar', 'landing.heroBold', undefined, { 'ar:landing.heroBold': 'خريطة' }) === 'خريطة',
    )
  } finally {
    await db.auditLog.deleteMany({ where: { entity: 'CopyRevision', entityId: { in: batches } } })
    await db.copyRevision.deleteMany({ where: { batchId: { in: batches } } })
    await db.copyPreview.deleteMany({ where: { id: { in: previews } } })
    await db.copyOverride.deleteMany({ where: { key: { in: keys } } })
    for (const row of saved) await db.copyOverride.create({ data: row })
  }

  // ── What is live still passes ────────────────────────────────────────────
  const live = await db.copyOverride.findMany()
  const stale = live.filter((row) => !isLocale(row.locale) || validateCopy(row.locale, row.key, row.value) !== null)
  report(`every published override (${live.length}) still passes the rules`, stale.length === 0, stale.map((r) => `${r.locale}:${r.key}`).join(', '))

  await db.$disconnect()
  console.log(failures ? `\n${failures} check(s) failed.\n` : '\nEdited copy publishes, previews, undoes and falls back safely.\n')
  process.exit(failures ? 1 : 0)
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
