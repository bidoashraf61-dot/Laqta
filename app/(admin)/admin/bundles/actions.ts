'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { actionT } from '@/lib/locale-request'
import { saveBundle, setBundleActive } from '@/lib/bundles'

/**
 * `/admin/bundles` (DEV-62). The rules, the Laqta-share ceiling and the audit
 * live in lib/bundles.ts; these translate the result and refresh the pages
 * that show a bundle — its page, album pages, the cart.
 */

export type BundleActionResult = { ok: boolean; message?: string; id?: string }

export type BundleFormInput = {
  id?: string | null
  slug: string
  titleAr: string
  titleEn: string
  descriptionAr: string
  descriptionEn: string
  pricing: string
  value: string
  /** ISO instants from the owner's clock, or ''. */
  startsAt: string
  endsAt: string
  isActive: boolean
  albumIds: string[]
}

const instant = (value: string) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function saveBundleAction(input: BundleFormInput): Promise<BundleActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  if (admin.impersonatedBy) return { ok: false, message: tr('state.forbidden') }
  const startsAt = instant(input.startsAt)
  const endsAt = instant(input.endsAt)
  if (startsAt === undefined || endsAt === undefined) return { ok: false, message: tr('dash.bundles.error.dates') }

  const result = await saveBundle(
    {
      id: input.id || null,
      slug: input.slug,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      descriptionAr: input.descriptionAr,
      descriptionEn: input.descriptionEn,
      pricing: input.pricing,
      value: Number(input.value),
      startsAt,
      endsAt,
      isActive: input.isActive,
      albumIds: Array.isArray(input.albumIds) ? input.albumIds.map(String) : [],
    },
    admin.id,
  )
  if (!result.ok) return { ok: false, message: tr(result.error.key, result.error.vars) }
  revalidatePath('/', 'layout')
  return { ok: true, message: tr('dash.bundles.saved'), id: result.id }
}

export async function setBundleActiveAction(id: string, isActive: boolean): Promise<BundleActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  if (admin.impersonatedBy) return { ok: false, message: tr('state.forbidden') }
  if (!(await setBundleActive(id, isActive, admin.id))) return { ok: false, message: tr('state.notFound') }
  revalidatePath('/', 'layout')
  return { ok: true, message: tr(isActive ? 'dash.bundles.activated' : 'dash.bundles.deactivated') }
}
