'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect } from '@/components/ui/input'
import { ActionButton, SettingsForm } from '@/components/dashboard/form'
import { approveCreator, setCreatorCommission, setCreatorStatus } from '@/app/(admin)/admin/actions'
import { t } from '@/lib/i18n'

/**
 * Per-creator controls.
 *
 * Status verbs sit inline; the commission editor is a disclosure, because
 * changing a rate is a considered act and the panel it opens has to say out
 * loud that it affects future sales only. Existing OrderItems carry their own
 * frozen rate and nothing here touches them.
 */
export function CreatorControls({
  creatorId,
  status,
  tier,
  overridePercent,
}: {
  creatorId: string
  status: string
  tier: string
  overridePercent: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === 'pending' ? (
          <ActionButton
            action={approveCreator.bind(null, creatorId)}
            label={t('dash.approveCreator')}
            variant="default"
          />
        ) : null}
        {status === 'approved' ? (
          <ActionButton
            action={setCreatorStatus.bind(null, creatorId, 'suspended')}
            label={t('dash.suspendCreator')}
            confirm={t('dash.suspendCreator')}
          />
        ) : null}
        {status === 'suspended' || status === 'rejected' ? (
          <ActionButton
            action={setCreatorStatus.bind(null, creatorId, 'approved')}
            label={t('dash.reinstateCreator')}
          />
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <SlidersHorizontal className="size-3.5" />
          {t('dash.commissionOverride')}
        </Button>
      </div>

      {open ? (
        <div className="w-full rounded-md border border-border/60 bg-background p-3 text-start">
          <SettingsForm action={setCreatorCommission}>
            <input type="hidden" name="creatorId" value={creatorId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('dash.tier')} htmlFor={`tier-${creatorId}`}>
                <NativeSelect id={`tier-${creatorId}`} name="tier" defaultValue={tier}>
                  <option value="standard">{t('dash.tierStandard')}</option>
                  <option value="silver">{t('dash.tierSilver')}</option>
                  <option value="gold">{t('dash.tierGold')}</option>
                </NativeSelect>
              </Field>
              <Field
                label={t('dash.commissionOverride')}
                htmlFor={`override-${creatorId}`}
                hint={t('dash.commissionOverrideHint')}
              >
                <Input
                  id={`override-${creatorId}`}
                  name="commissionRateOverride"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  dir="ltr"
                  defaultValue={overridePercent}
                />
              </Field>
            </div>
          </SettingsForm>
        </div>
      ) : null}
    </div>
  )
}
