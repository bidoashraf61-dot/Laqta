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
