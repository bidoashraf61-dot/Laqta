import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { SettingsForm } from '@/components/dashboard/form'
import { updatePayoutDetails, updateProfile } from '@/app/(studio)/studio/actions'
import { TIER_RATES } from '@/lib/commission'
import { formatMoney, formatPercent, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('dash.settings'),
  }
}

const TIER_LABEL: Record<string, string> = {
  standard: 'dash.tierStandard',
  silver: 'dash.tierSilver',
  gold: 'dash.tierGold',
}

/**
 * Creator settings.
 *
 * Two panels, because they answer different questions and fail differently:
 * the profile is public and cosmetic, the payout rail is private and gates
 * real money. Keeping them as separate forms means a typo in a bio can never
 * block saving a corrected IBAN.
 */
export default async function StudioSettingsPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const creator = await db.creator.findUnique({ where: { id: user.creatorId } })
  if (!creator) redirect('/sell')

  // The creator's share is the inverse of the platform take, and the override
  // wins over the tier when an admin has set one.
  const platformRate =
    creator.commissionRateOverride != null
      ? Number(creator.commissionRateOverride)
      : TIER_RATES[creator.tier] - (creator.isExclusive ? 0.05 : 0)

  return (
    <>
      <DashboardHeader title={t('dash.settings')} description={t('dash.profileHint')} />

      <div className="space-y-6">
        <Panel title={t('dash.commissionShare')}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="numeric text-3xl font-bold text-gold">
              {formatPercent(1 - platformRate, 0)}
            </p>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm">
                <Badge variant="neutral">{t(TIER_LABEL[creator.tier])}</Badge>
                <span className="numeric text-muted-foreground">
                  {formatMoney(Number(creator.lifetimeGmv))}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('dash.tierHint')}</p>
            </div>
          </div>
        </Panel>

        <Panel title={t('dash.profile')}>
          <SettingsForm action={updateProfile} className="max-w-2xl">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('dash.displayNameAr')} htmlFor="displayNameAr" required>
                <Input
                  id="displayNameAr"
                  name="displayNameAr"
                  required
                  maxLength={80}
                  defaultValue={creator.displayNameAr}
                />
              </Field>
              <Field label={t('dash.displayNameEn')} htmlFor="displayNameEn" required>
                <Input
                  id="displayNameEn"
                  name="displayNameEn"
                  required
                  maxLength={80}
                  dir="ltr"
                  defaultValue={creator.displayNameEn}
                />
              </Field>
            </div>

            <Field label={t('dash.handle')} htmlFor="handle" hint={t('dash.handleHint')} required>
              <Input
                id="handle"
                name="handle"
                required
                dir="ltr"
                pattern="[a-z0-9][a-z0-9\-]{1,38}"
                defaultValue={creator.handle}
              />
            </Field>

            <Field label={t('dash.bioAr')} htmlFor="bioAr">
              <Textarea
                id="bioAr"
                name="bioAr"
                rows={3}
                maxLength={600}
                defaultValue={creator.bioAr ?? ''}
              />
            </Field>
            <Field label={t('dash.bioEn')} htmlFor="bioEn">
              <Textarea
                id="bioEn"
                name="bioEn"
                rows={3}
                maxLength={600}
                dir="ltr"
                defaultValue={creator.bioEn ?? ''}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('dash.cityAr')} htmlFor="cityAr">
                <Input
                  id="cityAr"
                  name="cityAr"
                  maxLength={60}
                  defaultValue={creator.cityAr ?? ''}
                />
              </Field>
              <Field label={t('dash.cityEn')} htmlFor="cityEn">
                <Input
                  id="cityEn"
                  name="cityEn"
                  maxLength={60}
                  defaultValue={creator.cityEn ?? ''}
                />
              </Field>
              <Field label={t('dash.country')} htmlFor="country">
                <Input
                  id="country"
                  name="country"
                  maxLength={2}
                  dir="ltr"
                  defaultValue={creator.country}
                />
              </Field>
              <Field label={t('dash.showreel')} htmlFor="showreelUrl">
                <Input
                  id="showreelUrl"
                  name="showreelUrl"
                  type="url"
                  dir="ltr"
                  defaultValue={creator.showreelUrl ?? ''}
                />
              </Field>
            </div>
          </SettingsForm>
        </Panel>

        <Panel title={t('dash.payoutSettings')}>
          <Alert variant="info" className="mb-5">
            <AlertDescription>{t('dash.payoutSettingsHint')}</AlertDescription>
          </Alert>

          <SettingsForm action={updatePayoutDetails} className="max-w-2xl">
            <Field label={t('dash.payoutMethod')} htmlFor="payoutMethod" required>
              <NativeSelect
                id="payoutMethod"
                name="payoutMethod"
                required
                defaultValue={creator.payoutMethod}
              >
                <option value="iban">{t('dash.methodIban')}</option>
                <option value="payoneer">{t('dash.methodPayoneer')}</option>
                <option value="wise">{t('dash.methodWise')}</option>
              </NativeSelect>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('dash.iban')} htmlFor="iban">
                <Input
                  id="iban"
                  name="iban"
                  dir="ltr"
                  maxLength={34}
                  defaultValue={creator.iban ?? ''}
                />
              </Field>
              <Field label={t('dash.bankName')} htmlFor="bankName">
                <Input
                  id="bankName"
                  name="bankName"
                  maxLength={80}
                  defaultValue={creator.bankName ?? ''}
                />
              </Field>
            </div>

            <Field label={t('dash.beneficiary')} htmlFor="beneficiaryName">
              <Input
                id="beneficiaryName"
                name="beneficiaryName"
                maxLength={120}
                defaultValue={creator.beneficiaryName ?? ''}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('dash.payoneerEmail')} htmlFor="payoneerEmail">
                <Input
                  id="payoneerEmail"
                  name="payoneerEmail"
                  type="email"
                  dir="ltr"
                  defaultValue={creator.payoneerEmail ?? ''}
                />
              </Field>
              <Field label={t('dash.wiseEmail')} htmlFor="wiseEmail">
                <Input
                  id="wiseEmail"
                  name="wiseEmail"
                  type="email"
                  dir="ltr"
                  defaultValue={creator.wiseEmail ?? ''}
                />
              </Field>
            </div>

            <Field label={t('dash.taxResidency')} htmlFor="taxResidency">
              <Input
                id="taxResidency"
                name="taxResidency"
                maxLength={2}
                dir="ltr"
                defaultValue={creator.taxResidency ?? ''}
              />
            </Field>
          </SettingsForm>
        </Panel>

        <Panel title={t('security.title')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('security.twoFactorWhy')}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/account/security">
                <ShieldCheck />
                {t('security.title')}
              </Link>
            </Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
