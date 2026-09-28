import { cache } from 'react'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { findBannedClaim } from '@/lib/copy-claims'
import type { DocumentSection } from '@/components/layout/document-page'
import {
  ABOUT,
  CONTACT,
  CONTENT_POLICY,
  EFFECTIVE_FROM,
  LICENCES,
  PRIVACY,
  TERMS,
} from '@/content/legal'

/**
 * The long-form pages, editable from `/admin/content` (DEV-64a).
 *
 * ── Two layers ──────────────────────────────────────────────────────────────
 * The text in `content/legal.ts` is the DEFAULT layer: what a fresh database
 * renders, and what a page falls back to when its published version cannot be
 * read. Published versions (`DocumentVersion`) sit on top — the newest row per
 * page wins. Rows are never edited or deleted; a restore publishes a copy, so
 * every version keeps the date it took effect.
 *
 * ── Copy never breaks a page ────────────────────────────────────────────────
 * A database error, or a stored version that no longer passes validation,
 * renders the code default rather than an error boundary. The same validation
 * runs at publish, so the second case only happens if the rules tighten later.
 */

export const DOCUMENT_KEYS = ['terms', 'privacy', 'licences', 'content-policy', 'about', 'contact'] as const
export type DocumentKey = (typeof DOCUMENT_KEYS)[number]

export type DocumentDefinition = {
  key: DocumentKey
  /** The public route. */
  path: string
  /** messages key for the page title (shared with the footer link). */
  titleKey: string
  /** The code default. */
  defaults: DocumentSection[]
  /** The page states the date this text took effect. */
  dated: boolean
  /** The page renders a bullet list under a section. `/contact` does not. */
  lists: boolean
}

export const DOCUMENTS: Record<DocumentKey, DocumentDefinition> = {
  terms: { key: 'terms', path: '/terms', titleKey: 'footer.terms', defaults: TERMS, dated: true, lists: true },
  privacy: { key: 'privacy', path: '/privacy', titleKey: 'footer.privacy', defaults: PRIVACY, dated: true, lists: true },
  licences: { key: 'licences', path: '/licences', titleKey: 'footer.licences', defaults: LICENCES, dated: true, lists: true },
  'content-policy': {
    key: 'content-policy',
    path: '/content-policy',
    titleKey: 'footer.contentPolicy',
    defaults: CONTENT_POLICY,
    dated: true,
    lists: true,
  },
  about: { key: 'about', path: '/about', titleKey: 'footer.about', defaults: ABOUT, dated: false, lists: true },
  contact: { key: 'contact', path: '/contact', titleKey: 'footer.contact', defaults: CONTACT, dated: false, lists: false },
}

export function isDocumentKey(value: string): value is DocumentKey {
  return (DOCUMENT_KEYS as readonly string[]).includes(value)
}

/** `restoredFromId` of a version that re-published the code default. */
export const CODE_DEFAULT = 'code-default'

export const LIMITS = {
  sections: 40,
  heading: 140,
  paragraph: 3000,
  item: 600,
  note: 200,
} as const

// ─── Validation ──────────────────────────────────────────────────────────────

export type DocumentError = {
  /** messages key under dash.docs.error.* */
  key: string
  vars?: Record<string, string | number>
}

const ARABIC_LETTERS = /[؀-ۿݐ-ݿࢠ-ࣿ]/g
const LATIN_LETTERS = /[A-Za-z]/g

/**
 * Arabic pasted into an English box. Mostly-Arabic, not any-Arabic: the About
 * page's English quotes «العلا» on purpose, to show the search folding it.
 */
function looksArabic(text: string) {
  const arabic = text.match(ARABIC_LETTERS)?.length ?? 0
  const latin = text.match(LATIN_LETTERS)?.length ?? 0
  return arabic > latin
}
const MARKUP = /<\s*\/?\s*[a-z!][^>]*>/i

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const lines = (value: unknown) =>
  Array.isArray(value) ? value.map(clean).filter(Boolean) : []

/**
 * Trim everything, drop empty paragraphs and items, and turn an empty English
 * field into "absent" — which is what makes the English page fall back per
 * field instead of rendering a blank heading.
 */
export function normaliseSections(input: unknown): DocumentSection[] {
  if (!Array.isArray(input)) return []
  return input.map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>
    const section: DocumentSection = { heading: clean(s.heading), body: lines(s.body) }
    // An anchor (e.g. #cookies) survives a publish from the admin editor.
    const id = clean(s.id)
    if (/^[a-z][a-z0-9-]{0,40}$/.test(id)) section.id = id
    const list = lines(s.list)
    const headingEn = clean(s.headingEn)
    const bodyEn = lines(s.bodyEn)
    const listEn = lines(s.listEn)
    if (list.length) section.list = list
    if (headingEn) section.headingEn = headingEn
    if (bodyEn.length) section.bodyEn = bodyEn
    if (listEn.length) section.listEn = listEn
    return section
  })
}

/**
 * The rules a page must meet to be published. Returns the first failure, with
 * the section it is in (1-based) so the editor can point at it.
 */
export function validateSections(
  key: DocumentKey,
  sections: DocumentSection[],
): (DocumentError & { section?: number }) | null {
  const definition = DOCUMENTS[key]
  if (sections.length === 0) return { key: 'dash.docs.error.empty' }
  if (sections.length > LIMITS.sections) return { key: 'dash.docs.error.tooMany', vars: { max: LIMITS.sections } }

  for (const [index, s] of sections.entries()) {
    const at = index + 1
    const fail = (errorKey: string, vars: Record<string, string | number> = {}) => ({
      key: `dash.docs.error.${errorKey}`,
      vars: { section: at, ...vars },
      section: at,
    })

    if (!s.heading) return fail('heading')
    if (!s.body.length && !(s.list?.length)) return fail('body')
    if (!definition.lists && (s.list?.length || s.listEn?.length)) return fail('noLists')
    if (s.listEn?.length && !s.list?.length) return fail('listEnOnly')

    const english = [s.headingEn, ...(s.bodyEn ?? []), ...(s.listEn ?? [])].filter(Boolean) as string[]
    const all = [s.heading, ...s.body, ...(s.list ?? []), ...english]

    if ([s.heading, s.headingEn].some((h) => h && h.length > LIMITS.heading)) {
      return fail('headingLong', { max: LIMITS.heading })
    }
    if ([...s.body, ...(s.bodyEn ?? [])].some((p) => p.length > LIMITS.paragraph)) {
      return fail('paragraphLong', { max: LIMITS.paragraph })
    }
    if ([...(s.list ?? []), ...(s.listEn ?? [])].some((i) => i.length > LIMITS.item)) {
      return fail('itemLong', { max: LIMITS.item })
    }
    if (all.some((text) => MARKUP.test(text))) return fail('markup')
    if (english.some(looksArabic)) return fail('arabicInEnglish')

    for (const text of all) {
      const claim = findBannedClaim(text)
      if (claim) return fail('claim', { words: claim.match })
    }
  }
  return null
}

/** Sections with no English at all — the English page shows the Arabic there. */
export function untranslatedSections(sections: DocumentSection[]): number[] {
  return sections.flatMap((s, i) =>
    !s.headingEn || (s.body.length > 0 && !s.bodyEn?.length) || (s.list?.length && !s.listEn?.length) ? [i + 1] : [],
  )
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export type LoadedDocument = {
  key: DocumentKey
  sections: DocumentSection[]
  /** The date to print on the page, or null for an undated page. */
  effectiveFrom: Date | null
  /** The version on the site, or null when it is the code default. */
  versionId: string | null
}

/**
 * The page as the site shows it. Cached per render, and never throws.
 */
export const loadDocument = cache(async (key: DocumentKey): Promise<LoadedDocument> => {
  const definition = DOCUMENTS[key]
  const fallback: LoadedDocument = {
    key,
    sections: definition.defaults,
    effectiveFrom: definition.dated ? EFFECTIVE_FROM : null,
    versionId: null,
  }
  try {
    const latest = await db.documentVersion.findFirst({
      where: { docKey: key },
      orderBy: { publishedAt: 'desc' },
    })
    if (!latest) return fallback
    const sections = normaliseSections(latest.sections)
    const invalid = validateSections(key, sections)
    if (invalid) {
      console.error(`[documents] version ${latest.id} of ${key} no longer validates (${invalid.key}); showing the code default`)
      return fallback
    }
    return {
      key,
      sections,
      effectiveFrom: definition.dated ? latest.publishedAt : null,
      versionId: latest.id,
    }
  } catch (error) {
    console.error(`[documents] could not read ${key}; showing the code default`, error)
    return fallback
  }
})

export type VersionRow = {
  id: string
  sections: DocumentSection[]
  note: string | null
  restoredFromId: string | null
  publishedAt: Date
  publishedBy: string | null
}

/** Every published version of a page, newest first, with who published it. */
export async function listVersions(key: DocumentKey): Promise<VersionRow[]> {
  const rows = await db.documentVersion.findMany({
    where: { docKey: key },
    orderBy: { publishedAt: 'desc' },
  })
  const ids = [...new Set(rows.map((r) => r.publishedById).filter(Boolean))] as string[]
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : []
  const who = new Map(users.map((u) => [u.id, u.name || u.email]))
  return rows.map((r) => ({
    id: r.id,
    sections: normaliseSections(r.sections),
    note: r.note,
    restoredFromId: r.restoredFromId,
    publishedAt: r.publishedAt,
    publishedBy: r.publishedById ? (who.get(r.publishedById) ?? null) : null,
  }))
}

// ─── Writing ─────────────────────────────────────────────────────────────────

export type PublishResult =
  | { ok: true; versionId: string }
  | { ok: false; error: DocumentError & { section?: number } }

/**
 * Publish a page. Validated here, not only in the editor, because the action
 * is reachable without the editor. Audited.
 */
export async function publishDocument({
  key,
  sections: input,
  note: rawNote,
  actorId,
  restoredFromId = null,
}: {
  key: DocumentKey
  sections: unknown
  note?: string | null
  actorId: string
  restoredFromId?: string | null
}): Promise<PublishResult> {
  const sections = normaliseSections(input)
  const invalid = validateSections(key, sections)
  if (invalid) return { ok: false, error: invalid }
  const note = clean(rawNote)
  if (note.length > LIMITS.note) return { ok: false, error: { key: 'dash.docs.error.noteLong', vars: { max: LIMITS.note } } }

  const version = await db.documentVersion.create({
    data: {
      docKey: key,
      sections: sections as unknown as object,
      note: note || null,
      restoredFromId,
      publishedById: actorId,
    },
  })
  await recordAudit({
    actorId,
    action: restoredFromId ? 'document.restore' : 'document.publish',
    entity: 'DocumentVersion',
    entityId: version.id,
    detail: { docKey: key, note: note || null, restoredFromId, sections: sections.length },
  })
  return { ok: true, versionId: version.id }
}

/**
 * Put an earlier version — or the code default — back on the site, as a new
 * version. Nothing is overwritten.
 */
export async function restoreDocument({
  key,
  from,
  actorId,
}: {
  key: DocumentKey
  /** A version id of this page, or `CODE_DEFAULT`. */
  from: string
  actorId: string
}): Promise<PublishResult> {
  let sections: unknown
  if (from === CODE_DEFAULT) {
    sections = DOCUMENTS[key].defaults
  } else {
    const version = await db.documentVersion.findFirst({ where: { id: from, docKey: key } })
    if (!version) return { ok: false, error: { key: 'state.notFound' } }
    sections = version.sections
  }
  return publishDocument({ key, sections, actorId, restoredFromId: from })
}
