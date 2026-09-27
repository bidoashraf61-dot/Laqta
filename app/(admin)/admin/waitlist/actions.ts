'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { actionT } from '@/lib/locale-request'
import { notifyWaitlistOfLaunch, syncWaitlistToResend } from '@/lib/waitlist'
import { drainSoon } from '@/lib/outbox'
import type { ActionResult } from '@/components/dashboard/form'

/** Queue the launch notice to everyone still on the list who has not had it (DEV-45). */
export async function sendLaunchNoticeNow(): Promise<ActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const result = await notifyWaitlistOfLaunch()
  await recordAudit({ actorId: admin.id, action: 'waitlist.launch_notice', entity: 'WaitlistEntry', detail: result })
  drainSoon()
  revalidatePath('/admin/waitlist')
  return { ok: true, message: tr('dash.waitlistLaunchQueued', { count: result.queued }) }
}

/** Push the list to the Resend audience, when one is configured. */
export async function syncWaitlistNow(): Promise<ActionResult> {
  const tr = await actionT()
  const admin = await requireAdmin()
  const result = await syncWaitlistToResend()
  if (!result.ok) return { ok: false, message: tr('dash.waitlistSyncOff') }
  await recordAudit({ actorId: admin.id, action: 'waitlist.sync', entity: 'WaitlistEntry', detail: result })
  revalidatePath('/admin/waitlist')
  return { ok: true, message: tr('dash.waitlistSynced', { synced: result.synced, attempted: result.attempted }) }
}
