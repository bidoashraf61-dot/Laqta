import { redirect } from 'next/navigation'
import { requireCreator } from '@/lib/auth'
import { db } from '@/lib/db'
import { Field } from '@/components/ui/label'
import { Input, Textarea } from '@/components/ui/input'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { SettingsForm } from '@/components/dashboard/form'
import { createAlbum } from '@/app/(studio)/studio/actions'
import { formatMoney, formatNumber, t } from '@/lib/i18n'

export const metadata = { title: t('studio.newAlbum') }

/**
 * New album.
 *
 * Deliberately short: title, description, band. Price is not a field — it is
 * read off the PriceBand for the chosen band, so the catalogue keeps one price
 * per size of album and no creator can undercut or inflate it. Clips arrive
 * afterwards, on the album's own page.
 */
export default async function NewAlbumPage() {
  const user = await requireCreator()
  if (!user.creatorId) redirect('/sell')

  const bands = await db.priceBand.findMany({ orderBy: { priceStandard: 'asc' } })

  return (
    <>
      <DashboardHeader title={t('studio.newAlbum')} description={t('dash.newAlbumHint')} />

      <Panel>
        <SettingsForm action={createAlbum} submitLabel={t('dash.create')} className="max-w-2xl">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('dash.albumTitleAr')} htmlFor="titleAr" required>
              <Input id="titleAr" name="titleAr" required maxLength={120} />
            </Field>
            <Field label={t('dash.albumTitleEn')} htmlFor="titleEn" required>
              <Input id="titleEn" name="titleEn" required maxLength={120} dir="ltr" />
            </Field>
          </div>

          <Field label={t('dash.albumDescAr')} htmlFor="descriptionAr">
            <Textarea id="descriptionAr" name="descriptionAr" rows={3} maxLength={1000} />
          </Field>
          <Field label={t('dash.albumDescEn')} htmlFor="descriptionEn">
            <Textarea id="descriptionEn" name="descriptionEn" rows={3} maxLength={1000} dir="ltr" />
          </Field>

          <Field label={t('dash.albumTier')} htmlFor="tier" hint={t('dash.albumTierHint')} required>
            <div className="grid gap-2 sm:grid-cols-2">
              {bands.map((band, index) => (
                <label
                  key={band.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors has-[:checked]:border-gold/40 has-[:checked]:bg-gold/8 hover:border-foreground/25"
                >
                  <input
                    type="radio"
                    id={index === 0 ? 'tier' : undefined}
                    name="tier"
                    value={band.tier}
                    defaultChecked={band.tier === 'standard'}
                    className="mt-1 accent-[hsl(var(--gold))]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{band.labelAr}</span>
                    <span className="numeric block text-xs text-muted-foreground">
                      {formatNumber(band.minClips)}
                      {band.maxClips ? `–${formatNumber(band.maxClips)}` : '+'}{' '}
                    </span>
                    <span className="numeric mt-1 block text-sm text-gold">
                      {formatMoney(Number(band.priceStandard), band.currency)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </SettingsForm>
      </Panel>
    </>
  )
}
