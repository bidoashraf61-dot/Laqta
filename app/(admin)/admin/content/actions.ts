'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { actionT } from '@/lib/locale-request'
import {
  DOCUMENTS,
  isDocumentKey,
  publishDocument,
  restoreDocument,
  type PublishResult,
} from '@/lib/editable-documents'
import { publishCopy, saveCopyPreview, undoCopyBatch, type CopyPublishResult } from '@/lib/copy-overrides'
import { COPY_GROUPS } from '@/lib/copy-rules'

/**
 * Publish and restore the long-form pages — `/admin/content/[key]` (DEV-64a).
 * The rules and the audit live in lib/editable-documents.ts; these translate
 * the result and refresh the pages that show it.
 */

export type DocumentActionResult = { ok: boolean; message?: string; section?: number }

async function finish(key: string, result: PublishResult, okKey: string): Promise<DocumentActionResult> {
  const tr = await actionT()
  if (!result.ok) {
    return { ok: false, message: tr(result.error.key, result.error.vars), section: result.error.section }
  }
  if (isDocumentKey(key)) {
    revalidatePath(DOCUMENTS[key].path)
    revalidatePath(`/en${DOCUMENTS[key].path}`)
  }
  revalidatePath('/admin/content')
  return { ok: true, message: tr(okKey) }
}

export async function publishDocumentAction(
  key: string,
  sections: unknown,
  note: string,
): Promise<DocumentActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  if (admin.impersonatedBy) return { ok: false, message: tr('state.forbidden') }
  if (!isDocumentKey(key)) return { ok: false, message: tr('state.notFound') }
  const result = await publishDocument({ key, sections, note, actorId: admin.id })
  return finish(key, result, 'dash.docs.published')
}

/** `from` is a version id of this page, or `CODE_DEFAULT` for the original text. */
export async function restoreDocumentAction(key: string, from: string): Promise<DocumentActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  if (admin.impersonatedBy) return { ok: false, message: tr('state.forbidden') }
  if (!isDocumentKey(key)) return { ok: false, message: tr('state.notFound') }
  const result = await restoreDocument({ key, from, actorId: admin.id })
  return finish(key, result, 'dash.docs.restored')
}

// ─── Site copy (DEV-64b) ─────────────────────────────────────────────────────

export type CopyActionResult = {
  ok: boolean
  message?: string
  /** The string a refusal is about, so the editor can point at it. */
  at?: { key: string; locale: 'ar' | 'en' }
  /** Set by the preview action. */
  previewId?: string
}

async function finishCopy(result: CopyPublishResult, okKey: string): Promise<CopyActionResult> {
  const tr = await actionT()
  if (!result.ok) return { ok: false, message: tr(result.error.key, result.error.vars), at: result.error.at }
  // The edited copy is read inside translate() on every page, so every page
  // that shows it is stale — the landing, /sell, both languages.
  for (const group of Object.values(COPY_GROUPS)) {
    if (group.path) {
      revalidatePath(group.path)
      revalidatePath(`/en${group.path === '/' ? '' : group.path}`)
    }
  }
  revalidatePath('/admin/content', 'layout')
  return { ok: true, message: tr(okKey) }
}

/** `changes`: `[{ key, locale, value }]`; an empty value means "back to the original". */
export async function publishCopyAction(changes: unknown, note: string): Promise<CopyActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  if (admin.impersonatedBy) return { ok: false, message: tr('state.forbidden') }
  return finishCopy(await publishCopy({ changes, note, actorId: admin.id }), 'dash.copy.publishedToast')
}

export async function undoCopyBatchAction(batchId: string): Promise<CopyActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  if (admin.impersonatedBy) return { ok: false, message: tr('state.forbidden') }
  return finishCopy(await undoCopyBatch({ batchId, actorId: admin.id }), 'dash.copy.undone')
}

/** Store drafts for `?copyPreview=<id>` — shown to admins only (middleware). */
export async function previewCopyAction(changes: unknown): Promise<CopyActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  if (admin.impersonatedBy) return { ok: false, message: tr('state.forbidden') }
  const result = await saveCopyPreview({ values: changes, actorId: admin.id })
  if (!result.ok) return { ok: false, message: tr(result.error.key, result.error.vars), at: result.error.at }
  return { ok: true, previewId: result.id }
}
