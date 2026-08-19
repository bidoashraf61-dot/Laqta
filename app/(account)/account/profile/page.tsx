import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SettingsForm } from '@/components/dashboard/form'
import { Alert, AlertDescription } from '@/components/ui/state'
import { PageTitle } from '@/components/ui/typography'
import { BackLink } from '@/components/dashboard/primitives'
import { requestLocale } from '@/lib/locale-request'
import { updateProfile, sendEmailVerification, sendPhoneCode, confirmPhoneCode } from '../actions'
import { VerifyEmail, VerifyPhone } from '@/components/account/verify-channel'
import { Badge } from '@/components/ui/badge'
import { COUNTRIES, countryName } from '@/lib/countries'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return { title: t('account.profileEdit') }
}

/**
 * Edit your own details.
 *
 * ── Why a page and not an inline form ───────────────────────────────────────
 * Two of these fields are login credentials. An inline toggle on the hub makes
 * changing an email feel like renaming a folder; a page you navigate to, with
 * its own heading and a warning about verification, matches the weight of what
 * is actually happening.
 *
 * It is also a plain server-rendered form, so it works before hydration and if
 * the client bundle never arrives — which is the right property for the screen
 * that can lock someone out of their own account.
 */
export default async function ProfilePage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/account/profile')

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      country: true,
      emailVerified: true,
      phoneVerified: true,
    },
  })
  if (!user) redirect('/account')

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href="/account" label={t('nav.account')} />
      <PageTitle>{t('account.profileEdit')}</PageTitle>

      {/* Said before the fields, not after the save. Someone editing an email
          needs to know it costs them their verified status BEFORE they do it. */}
      <Alert variant="warning">
        <AlertDescription>{t('account.profileCredentialWarning')}</AlertDescription>
      </Alert>

      <SettingsForm action={updateProfile}>
        <div className="grid gap-5">
          <Field label={t('account.profileName')} htmlFor="name" required>
            <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={user.name ?? ''} />
          </Field>

          <Field
            label={t('account.profileEmail')}
            htmlFor="email"
            hint={t('account.profileEmailHint')}
            required
          >
            {/* `dir="ltr"` on a field whose content is always Latin, even on an
                RTL page — see the rule in CLAUDE.md. */}
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              required
              maxLength={160}
              defaultValue={user.email ?? ''}
            />
          </Field>

          <Field
            label={t('account.profilePhone')}
            htmlFor="phone"
            hint={t('account.profilePhoneHint')}
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              maxLength={20}
              defaultValue={user.phone ?? ''}
            />
          </Field>

          <Field label={t('account.profileCountry')} htmlFor="country">
            {/*
              A select, not a free-text box.
              
              The column stores an ISO code so the name can be rendered in the
              reader's own language; a text input would collect «السعودية» from
              one person and "KSA" from the next, and neither could be shown in
              the other language. The list is short because it is the countries
              this catalogue's buyers and creators actually come from — with an
              explicit "prefer not to say" instead of a silent blank.
            */}
            <select
              id="country"
              name="country"
              defaultValue={user.country ?? ''}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('account.profileCountryNone')}</option>
              {COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {countryName(code)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SettingsForm>

      {/*
        Verification.

        Below the form rather than inside it, because these are not fields —
        they act on the address that is SAVED, not on whatever is currently
        typed in the box above. Putting a "verify" button next to an input the
        reader is mid-way through editing invites them to verify a value the
        server has never seen.
      */}
      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="font-display text-lg font-bold">{t('account.verifyTitle')}</h2>

        <div className="space-y-4">
          <ChannelRow
            label={t('account.profileEmail')}
            value={user.email}
            verified={Boolean(user.emailVerified)}
          >
            <VerifyEmail send={sendEmailVerification} />
          </ChannelRow>

          <ChannelRow
            label={t('account.profilePhone')}
            value={user.phone}
            verified={Boolean(user.phoneVerified)}
          >
            <VerifyPhone send={sendPhoneCode} confirm={confirmPhoneCode} />
          </ChannelRow>
        </div>
      </section>
    </div>
  )
}

/**
 * One channel and its state.
 *
 * A channel with nothing in it renders nothing at all — an empty row offering
 * to verify a blank mobile is an invitation to a dead end, and the form above
 * is where you add one.
 */
function ChannelRow({
  label,
  value,
  verified,
  children,
}: {
  label: string
  value: string | null
  verified: boolean
  children: React.ReactNode
}) {
  if (!value) return null

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4 last:border-b-0 last:pb-0">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="ltr-island text-sm font-medium">{value}</p>
      </div>
      {verified ? (
        <Badge variant="success">{t('account.profileVerified')}</Badge>
      ) : (
        <div className="space-y-2">
          <Badge variant="warning">{t('account.profileUnverified')}</Badge>
          {children}
        </div>
      )}
    </div>
  )
}
