import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { setPublishedCopy, type CopyOverrideMap } from '@/lib/i18n'
import { defaultCopy, isEditableKey, validateCopy, type CopyError } from '@/lib/copy-rules'
import { isLocale, type Locale } from '@/lib/locale'

/**
 * Edited interface copy — the database half (DEV-64b). Rules live in
 * `lib/copy-rules.ts`, the lookup in `lib/i18n.ts#translate`.
 *
 * ── Resolution ──────────────────────────────────────────────────────────────
 * draft (a preview render only) → published `CopyOverride` → messages JSON.
 * A missing or removed override is the JSON value, never a blank.
 *
 * ── Caching ─────────────────────────────────────────────────────────────────
 * The published map is one query, held in the process and re-read at most
 * every REFRESH_MS; publishing clears it in the process that published. A
 * second server instance picks the change up within REFRESH_MS. If the read
 * fails the previous map stays — copy is never a reason for a page to fail.
 */

const REFRESH_MS = 15_000
let loadedAt = 0
let inflight: Promise<void> | null = null

export async function refreshCopyOverrides(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const rows = await db.copyOverride.findMany({ select: { key: true, locale: true, value: true } })
      const map: CopyOverrideMap = {}
      for (const row of rows) {
        if (isLocale(row.locale) && isEditableKey(row.key)) map[`${row.locale}:${row.key}`] = row.value
      }
      setPublishedCopy(map)
      loadedAt = Date.now()
    } catch (error) {
      console.error('[copy] could not read overrides; keeping the previous copy', error)
    } finally {
      inflight = null
    }
  })()
  return inflight
}

// ─── Publishing ──────────────────────────────────────────────────────────────

export type CopyChange = { key: string; locale: Locale; value: string }

export type CopyPublishResult =
  | { ok: true; batchId: string; changed: number }
  | { ok: false; error: CopyError & { at?: { key: string; locale: Locale } } }

/**
 * Publish a set of edits as one batch. A value equal to the JSON default — or
 * empty — removes the override (back to the original). Every change is checked
 * before anything is written, and the batch is written in one transaction.
 * Audited as `copy.publish` (or `copy.restore`).
 */
export async function publishCopy({
  changes: input,
  note: rawNote,
  actorId,
  restoredFromBatchId = null,
}: {
  changes: unknown
  note?: string | null
  actorId: string
  restoredFromBatchId?: string | null
}): Promise<CopyPublishResult> {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: { key: 'dash.copy.error.nothing' } }
  if (input.length > 600) return { ok: false, error: { key: 'dash.copy.error.nothing' } }
  const note = typeof rawNote === 'string' ? rawNote.trim() : ''
  if (note.length > 200) return { ok: false, error: { key: 'dash.copy.error.noteLong', vars: { max: 200 } } }

  const changes: Array<{ key: string; locale: Locale; value: string | null }> = []
  const seen = new Set<string>()
  for (const raw of input as Array<Record<string, unknown>>) {
    const key = typeof raw?.key === 'string' ? raw.key : ''
    const locale = typeof raw?.locale === 'string' && isLocale(raw.locale) ? raw.locale : null
    const value = typeof raw?.value === 'string' ? raw.value.trim() : ''
    if (!locale || !isEditableKey(key)) return { ok: false, error: { key: 'dash.copy.error.unknownKey' } }
    const id = `${locale}:${key}`
    if (seen.has(id)) continue
    seen.add(id)
    const reset = value === '' || value === defaultCopy(locale, key)
    if (!reset) {
      const error = validateCopy(locale, key, value)
      if (error) return { ok: false, error: { ...error, at: { key, locale } } }
    }
    changes.push({ key, locale, value: reset ? null : value })
  }

  const current = await db.copyOverride.findMany({
    where: { OR: changes.map(({ key, locale }) => ({ key, locale })) },
  })
  const before = new Map(current.map((row) => [`${row.locale}:${row.key}`, row.value]))
  const effective = changes.filter((c) => (before.get(`${c.locale}:${c.key}`) ?? null) !== c.value)
  if (effective.length === 0) return { ok: false, error: { key: 'dash.copy.error.nothing' } }

  const batchId = randomUUID()
  await db.$transaction([
    ...effective.map((c) =>
      c.value === null
        ? db.copyOverride.deleteMany({ where: { key: c.key, locale: c.locale } })
        : db.copyOverride.upsert({
            where: { key_locale: { key: c.key, locale: c.locale } },
            create: { key: c.key, locale: c.locale, value: c.value, updatedById: actorId },
            update: { value: c.value, updatedById: actorId },
          }),
    ),
    db.copyRevision.createMany({
      data: effective.map((c) => ({
        batchId,
        key: c.key,
        locale: c.locale,
        before: before.get(`${c.locale}:${c.key}`) ?? null,
        after: c.value,
        note: note || null,
        restoredFromBatchId,
        publishedById: actorId,
      })),
    }),
  ])
  await recordAudit({
    actorId,
    action: restoredFromBatchId ? 'copy.restore' : 'copy.publish',
    entity: 'CopyRevision',
    entityId: batchId,
    detail: { keys: effective.map((c) => `${c.locale}:${c.key}`), note: note || null, restoredFromBatchId },
  })
  await refreshCopyOverrides(true)
  return { ok: true, batchId, changed: effective.length }
}

/**
 * Undo a publish: every string it changed goes back to what it was before
 * (an override, or the original), as a new batch. Nothing is deleted.
 */
export async function undoCopyBatch({ batchId, actorId }: { batchId: string; actorId: string }): Promise<CopyPublishResult> {
  const rows = await db.copyRevision.findMany({ where: { batchId } })
  if (rows.length === 0) return { ok: false, error: { key: 'state.notFound' } }
  return publishCopy({
    changes: rows.map((row) => ({ key: row.key, locale: row.locale, value: row.before ?? '' })),
    actorId,
    restoredFromBatchId: batchId,
  })
}

export type CopyBatch = {
  batchId: string
  publishedAt: Date
  publishedBy: string | null
  note: string | null
  restoredFromBatchId: string | null
  changes: Array<{ key: string; locale: Locale; before: string | null; after: string | null }>
}

/** The newest publishes that touched a key with `prefix`, newest first. */
export async function listCopyBatches(prefix: string, limit = 20): Promise<CopyBatch[]> {
  const recent = await db.copyRevision.findMany({
    where: { key: { startsWith: prefix } },
    orderBy: { publishedAt: 'desc' },
    distinct: ['batchId'],
    take: limit,
    select: { batchId: true },
  })
  if (!recent.length) return []
  const rows = await db.copyRevision.findMany({
    where: { batchId: { in: recent.map((r) => r.batchId) } },
    orderBy: [{ publishedAt: 'desc' }, { key: 'asc' }],
  })
  const ids = [...new Set(rows.map((r) => r.publishedById).filter(Boolean))] as string[]
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : []
  const who = new Map(users.map((u) => [u.id, u.name || u.email]))
  const batches = new Map<string, CopyBatch>()
  for (const row of rows) {
    let batch = batches.get(row.batchId)
    if (!batch) {
      batch = {
        batchId: row.batchId,
        publishedAt: row.publishedAt,
        publishedBy: row.publishedById ? (who.get(row.publishedById) ?? null) : null,
        note: row.note,
        restoredFromBatchId: row.restoredFromBatchId,
        changes: [],
      }
      batches.set(row.batchId, batch)
    }
    if (isLocale(row.locale)) batch.changes.push({ key: row.key, locale: row.locale, before: row.before, after: row.after })
  }
  return [...batches.values()].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

/** The published overrides for a group, as `{ "<locale>:<key>": value }`. */
export async function groupOverrides(prefix: string): Promise<CopyOverrideMap> {
  const rows = await db.copyOverride.findMany({ where: { key: { startsWith: prefix } } })
  return Object.fromEntries(rows.map((row) => [`${row.locale}:${row.key}`, row.value]))
}

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Store drafts for a preview render. Drafts are validated like a publish, so a
 * preview never shows a page the publish would refuse. Rows older than a day
 * are pruned on the way in.
 */
export async function saveCopyPreview({
  values: input,
  actorId,
}: {
  values: unknown
  actorId: string
}): Promise<{ ok: true; id: string } | { ok: false; error: CopyError & { at?: { key: string; locale: Locale } } }> {
  const values: CopyOverrideMap = {}
  if (Array.isArray(input)) {
    for (const raw of input as Array<Record<string, unknown>>) {
      const key = typeof raw?.key === 'string' ? raw.key : ''
      const locale = typeof raw?.locale === 'string' && isLocale(raw.locale) ? raw.locale : null
      const value = typeof raw?.value === 'string' ? raw.value.trim() : ''
      if (!locale || !isEditableKey(key)) return { ok: false, error: { key: 'dash.copy.error.unknownKey' } }
      const text = value || defaultCopy(locale, key)
      const error = validateCopy(locale, key, text)
      if (error) return { ok: false, error: { ...error, at: { key, locale } } }
      values[`${locale}:${key}`] = text
    }
  }
  await db.copyPreview.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } })
  const row = await db.copyPreview.create({ data: { values, createdById: actorId } })
  return { ok: true, id: row.id }
}

/** A stored preview's drafts, or null. Callers check the viewer is an admin. */
export async function loadCopyPreview(id: string): Promise<CopyOverrideMap | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null
  try {
    const row = await db.copyPreview.findUnique({ where: { id } })
    if (!row || typeof row.values !== 'object' || row.values === null) return null
    const map: CopyOverrideMap = {}
    for (const [k, v] of Object.entries(row.values as Record<string, unknown>)) {
      const [locale, ...rest] = k.split(':')
      const key = rest.join(':')
      if (typeof v === 'string' && isLocale(locale) && isEditableKey(key)) map[k] = v
    }
    return map
  } catch {
    return null
  }
}
