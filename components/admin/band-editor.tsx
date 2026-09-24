'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect } from '@/components/ui/input'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { deletePriceBand, savePriceBand } from '@/app/(admin)/admin/actions'
import { useLocale, useT } from '@/lib/i18n-client'
import { formatMoneyIn } from '@/lib/i18n'

export type EditableBand = {
  id: string
  tier: string
  labelAr: string
  labelEn: string
  minClips: number
  maxClips: number | null
  price: number
  currency: string
  fit: 'inside' | 'partial' | 'outside'
  albumCount: number
}

const TIER_KEY: Record<string, string> = {
  mini: 'dash.tierMini',
  standard: 'dash.tierStandardAlbum',
  pro: 'dash.tierPro',
  signature: 'dash.tierSignature',
}

/** The fields shared by "edit" and "new". */
function BandFields({ band, tiers }: { band?: EditableBand; tiers: string[] }) {
  const t = useT()
  const key = band?.id ?? 'new'
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {band ? (
        <input type="hidden" name="id" value={band.id} />
      ) : null}
      {band ? (
        <input type="hidden" name="tier" value={band.tier} />
      ) : (
        <Field label={t('dash.bandTierField')} htmlFor={`band-tier-${key}`}>
          <NativeSelect id={`band-tier-${key}`} name="tier" defaultValue={tiers[0]}>
            {tiers.map((tier) => (
              <option key={tier} value={tier}>
                {t(TIER_KEY[tier])}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label={t('dash.bandLabelAr')} htmlFor={`band-ar-${key}`}>
        <Input id={`band-ar-${key}`} name="labelAr" required defaultValue={band?.labelAr} />
      </Field>
      <Field label={t('dash.bandLabelEn')} htmlFor={`band-en-${key}`}>
        <Input id={`band-en-${key}`} name="labelEn" required dir="ltr" defaultValue={band?.labelEn} />
      </Field>
      <Field label={t('dash.bandMin')} htmlFor={`band-min-${key}`}>
        <Input
          id={`band-min-${key}`}
          name="minClips"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          dir="ltr"
          defaultValue={band?.minClips}
        />
      </Field>
      <Field label={t('dash.bandMax')} htmlFor={`band-max-${key}`} hint={t('dash.bandMaxHint')}>
        <Input
          id={`band-max-${key}`}
          name="maxClips"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          dir="ltr"
          defaultValue={band?.maxClips ?? ''}
        />
      </Field>
      <Field label={t('dash.bandPriceField')} htmlFor={`band-price-${key}`}>
        <Input
          id={`band-price-${key}`}
          name="priceStandard"
          type="number"
          inputMode="decimal"
          min={1}
          step={1}
          required
          dir="ltr"
          defaultValue={band?.price}
        />
      </Field>
    </div>
  )
}

/**
 * The price band editor.
 *
 * A list rather than a grid of inputs: bands are edited rarely and on
 * purpose, so each opens its own form with the consequence stated above the
 * fields, instead of four rows of live inputs one stray keystroke from a
 * pricing change.
 */
export function BandEditor({ bands, freeTiers }: { bands: EditableBand[]; freeTiers: string[] }) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border/60">
        {bands.map((band) => (
          <li key={band.id} className="py-3 first:pt-0" data-band-row={band.tier}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {band.labelAr}
                  {band.fit !== 'inside' ? (
                    <Badge variant="warning">{t('dash.bandOutside')}</Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('dash.colClips')}:{' '}
                  <span className="numeric">
                    {band.minClips}
                    {band.maxClips ? `–${band.maxClips}` : '+'}
                  </span>
                  {' · '}
                  {t('dash.bandAlbums')}: <span className="numeric">{band.albumCount}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="numeric text-sm font-medium text-gold" data-band-price>
                  {formatMoneyIn(locale, band.price, band.currency)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={open === band.id}
                  onClick={() => setOpen((value) => (value === band.id ? null : band.id))}
                >
                  <Pencil className="size-3.5" />
                  {t('dash.bandEdit')}
                </Button>
              </div>
            </div>
            {open === band.id ? (
              <div className="mt-3 rounded-md border border-border/60 bg-background p-3">
                <SettingsForm action={savePriceBand}>
                  <BandFields band={band} tiers={freeTiers} />
                </SettingsForm>
                <div className="mt-3 border-t border-border/60 pt-3">
                  <ActionButton
                    action={deletePriceBand.bind(null, band.id)}
                    label={t('dash.bandDelete')}
                    confirm={t('dash.bandDeleteConfirm')}
                    variant="ghost"
                  />
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {freeTiers.length > 0 ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open === 'new'}
            onClick={() => setOpen((value) => (value === 'new' ? null : 'new'))}
          >
            <Plus className="size-3.5" />
            {t('dash.bandNew')}
          </Button>
          {open === 'new' ? (
            <div className="mt-3 rounded-md border border-border/60 bg-background p-3">
              <SettingsForm action={savePriceBand}>
                <BandFields tiers={freeTiers} />
              </SettingsForm>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('dash.bandNoFreeTier')}</p>
      )}
    </div>
  )
}
