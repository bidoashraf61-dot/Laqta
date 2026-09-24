'use client'

import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { setUserStatus, startViewAsUser } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

/** Suspend / reactivate one account. Hidden for admins — the action refuses them anyway. */
export function UserStatusControl({ userId, status }: { userId: string; status: string }) {
  const t = useT()
  if (status === 'suspended') {
    return (
      <ActionButton
        action={setUserStatus.bind(null, userId, 'active')}
        label={t('dash.reactivateUser')}
      />
    )
  }
  return (
    <ActionButton
      action={setUserStatus.bind(null, userId, 'suspended')}
      label={t('dash.suspendUser')}
      confirm={t('dash.suspendUserConfirm')}
    />
  )
}

/**
 * Start a view-as-user session. The reason is required (the action refuses an
 * empty one too); the reference is optional. Success redirects into the
 * customer's account with the banner showing, so there is no success state
 * to render here — only a refusal.
 */
export function ViewAsForm({ userId, minutes }: { userId: string; minutes: number }) {
  const t = useT()
  return (
    <SettingsForm action={startViewAsUser} submitLabel={t('dash.viewAsStart')}>
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-muted-foreground">{t('dash.viewAsHint', { minutes })}</p>
      <Field label={t('dash.viewAsReason')} htmlFor="view-as-reason" hint={t('dash.viewAsReasonHint')}>
        <Textarea id="view-as-reason" name="reason" required rows={2} maxLength={500} />
      </Field>
      <Field label={t('dash.viewAsTicket')} htmlFor="view-as-ticket">
        <Input id="view-as-ticket" name="ticketRef" maxLength={120} dir="ltr" />
      </Field>
    </SettingsForm>
  )
}
