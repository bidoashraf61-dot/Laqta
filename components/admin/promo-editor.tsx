'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/toggles'
import { SettingsForm } from '@/components/dashboard/form'
import { savePromo } from '@/app/(admin)/admin/actions'
import { t } from '@/lib/i18n'

export type PromoValue = {
  id: string
  code: string
  kind: string
  value: string
  maxRedemptions: number | null
  minOrderTotal: string | null
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
}

/** Create or edit a promo code. */
export function PromoEditor({ promo }: { promo?: PromoValue }) {
  const [open, setOpen] = useState(false)
  const id = promo?.id ?? 'new'

  return (
    <div>
      <Button
        type="button"
        variant={promo ? 'ghost' : 'gold'}
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {promo ? <Pencil className="size-3.5" /> : <Plus />}
        {promo ? t('actions.edit') : t('dash.newPromo')}
      </Button>

      {open ? (
        <div className="mt-3 rounded-md border border-border/60 bg-background p-4 text-start">
          <SettingsForm action={savePromo}>
            {promo ? <input type="hidden" name="id" value={promo.id} /> : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('dash.promoCode')} htmlFor={`code-${id}`} required>
                <Input
                  id={`code-${id}`}
                  name="code"
                  required
                  dir="ltr"
                  maxLength={32}
                  defaultValue={promo?.code ?? ''}
                />
              </Field>
              <Field label={t('dash.promoKind')} htmlFor={`kind-${id}`} required>
                <NativeSelect
                  id={`kind-${id}`}
                  name="kind"
                  required
                  defaultValue={promo?.kind ?? 'percent'}
                >
                  <option value="percent">{t('dash.promoPercent')}</option>
                  <option value="fixed">{t('dash.promoFixed')}</option>
                </NativeSelect>
              </Field>
              <Field label={t('dash.promoValue')} htmlFor={`value-${id}`} required>
                <Input
                  id={`value-${id}`}
                  name="value"
                  type="number"
                  min={0.01}
                  step={0.01}
                  required
                  dir="ltr"
                  defaultValue={promo?.value ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('dash.promoLimit')} htmlFor={`max-${id}`}>
                <Input
                  id={`max-${id}`}
                  name="maxRedemptions"
                  type="number"
                  min={1}
                  dir="ltr"
                  defaultValue={promo?.maxRedemptions ?? ''}
                />
              </Field>
              <Field label={t('dash.promoMinOrder')} htmlFor={`min-${id}`}>
                <Input
                  id={`min-${id}`}
                  name="minOrderTotal"
                  type="number"
                  min={0}
                  step={0.01}
                  dir="ltr"
                  defaultValue={promo?.minOrderTotal ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('dash.validFrom')} htmlFor={`from-${id}`}>
                <Input
                  id={`from-${id}`}
                  name="startsAt"
                  type="date"
                  dir="ltr"
                  defaultValue={promo?.startsAt ?? ''}
                />
              </Field>
              <Field label={t('dash.validTo')} htmlFor={`to-${id}`}>
                <Input
                  id={`to-${id}`}
                  name="endsAt"
                  type="date"
                  dir="ltr"
                  defaultValue={promo?.endsAt ?? ''}
                />
              </Field>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox name="isActive" defaultChecked={promo?.isActive ?? true} value="on" />
              {t('dash.promoActive')}
            </label>
          </SettingsForm>
        </div>
      ) : null}
    </div>
  )
}
