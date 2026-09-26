'use client'

import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { makeCreator, setUserStatus, startViewAsUser } from '@/app/(admin)/admin/actions'
import { Checkbox } from '@/components/ui/toggles'
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

/**
 * Make this account a creator (DEV-05). The country names arrive already in
 * the reader's language — `countryName` reads the server's locale store, which
 * a client component cannot. On success the page revalidates and the creator
 * panel replaces this form.
 */
export function MakeCreatorForm({
  userId,
  countries,
}: {
  userId: string
  countries: Array<{ code: string; name: string }>
}) {
  const t = useT()
  return (
    <SettingsForm action={makeCreator} submitLabel={t('dash.makeCreatorSubmit')}>
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-muted-foreground">{t('dash.makeCreatorHint')}</p>
      <Field
        label={t('dash.makeCreatorHandle')}
        htmlFor="creator-handle"
        hint={t('dash.makeCreatorHandleHint')}
        required
      >
        <Input
          id="creator-handle"
          name="handle"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-z0-9][a-z0-9\-]{1,28}[a-z0-9]"
          autoComplete="off"
          dir="ltr"
        />
      </Field>
      <Field label={t('dash.makeCreatorNameAr')} htmlFor="creator-name-ar" required>
        <Input id="creator-name-ar" name="displayNameAr" required maxLength={80} dir="rtl" />
      </Field>
      <Field label={t('dash.makeCreatorNameEn')} htmlFor="creator-name-en" required>
        <Input id="creator-name-en" name="displayNameEn" required maxLength={80} dir="ltr" />
      </Field>
      <Field label={t('dash.makeCreatorCountry')} htmlFor="creator-country">
        <select
          id="creator-country"
          name="country"
          defaultValue="EG"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-start gap-2.5">
        <Checkbox id="creator-founding" name="founding" value="on" defaultChecked className="mt-0.5" />
        <div className="space-y-0.5">
          <label htmlFor="creator-founding" className="cursor-pointer text-sm font-medium">
            {t('dash.makeCreatorFounding')}
          </label>
          <p className="text-xs text-muted-foreground">{t('dash.makeCreatorFoundingHint')}</p>
        </div>
      </div>
    </SettingsForm>
  )
}
