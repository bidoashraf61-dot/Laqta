'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SettingsForm } from '@/components/dashboard/form'
import { saveSlot } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

export type SlotValue = {
  id: string
  key: string
  titleAr: string | null
  titleEn: string | null
  subtitleAr: string | null
  subtitleEn: string | null
  ctaLabelAr: string | null
  ctaLabelEn: string | null
  linkUrl: string | null
  mediaUrl: string | null
  sortOrder: number
  startsAt: string | null
  endsAt: string | null
}

/**
 * Homepage slot editor.
 *
 * Copy, media and the scheduling window, per slot. The window is the reason
 * this exists as a form rather than a code change: a campaign banner that
 * starts on a date and expires on its own is the difference between marketing
 * being able to run a launch and marketing having to file a ticket.
 */
export function SlotEditor({ slot }: { slot: SlotValue }) {
  const t = useT()

  const [open, setOpen] = useState(false)

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Pencil className="size-3.5" />
        {t('actions.edit')}
      </Button>

      {open ? (
        <div className="mt-3 rounded-md border border-border/60 bg-background p-4">
          <SettingsForm action={saveSlot}>
            <input type="hidden" name="id" value={slot.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`${t('dash.slotTitle')} — ${t('dash.termAr')}`}
                htmlFor={`ta-${slot.id}`}
              >
                <Input id={`ta-${slot.id}`} name="titleAr" defaultValue={slot.titleAr ?? ''} />
              </Field>
              <Field
                label={`${t('dash.slotTitle')} — ${t('dash.termEn')}`}
                htmlFor={`te-${slot.id}`}
              >
                <Input
                  id={`te-${slot.id}`}
                  name="titleEn"
                  dir="ltr"
                  defaultValue={slot.titleEn ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`${t('dash.slotSubtitle')} — ${t('dash.termAr')}`}
                htmlFor={`sa-${slot.id}`}
              >
                <Input
                  id={`sa-${slot.id}`}
                  name="subtitleAr"
                  defaultValue={slot.subtitleAr ?? ''}
                />
              </Field>
              <Field
                label={`${t('dash.slotSubtitle')} — ${t('dash.termEn')}`}
                htmlFor={`se-${slot.id}`}
              >
                <Input
                  id={`se-${slot.id}`}
                  name="subtitleEn"
                  dir="ltr"
                  defaultValue={slot.subtitleEn ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t('dash.slotCta')} — ${t('dash.termAr')}`} htmlFor={`ca-${slot.id}`}>
                <Input
                  id={`ca-${slot.id}`}
                  name="ctaLabelAr"
                  defaultValue={slot.ctaLabelAr ?? ''}
                />
              </Field>
              <Field label={`${t('dash.slotCta')} — ${t('dash.termEn')}`} htmlFor={`ce-${slot.id}`}>
                <Input
                  id={`ce-${slot.id}`}
                  name="ctaLabelEn"
                  dir="ltr"
                  defaultValue={slot.ctaLabelEn ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('dash.slotLink')} htmlFor={`link-${slot.id}`}>
                <Input
                  id={`link-${slot.id}`}
                  name="linkUrl"
                  dir="ltr"
                  defaultValue={slot.linkUrl ?? ''}
                />
              </Field>
              <Field label={t('dash.slotMedia')} htmlFor={`media-${slot.id}`}>
                <Input
                  id={`media-${slot.id}`}
                  name="mediaUrl"
                  dir="ltr"
                  defaultValue={slot.mediaUrl ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('dash.validFrom')} htmlFor={`from-${slot.id}`}>
                <Input
                  id={`from-${slot.id}`}
                  name="startsAt"
                  type="date"
                  dir="ltr"
                  defaultValue={slot.startsAt ?? ''}
                />
              </Field>
              <Field label={t('dash.validTo')} htmlFor={`to-${slot.id}`}>
                <Input
                  id={`to-${slot.id}`}
                  name="endsAt"
                  type="date"
                  dir="ltr"
                  defaultValue={slot.endsAt ?? ''}
                />
              </Field>
              <Field label={t('dash.sortOrder')} htmlFor={`sort-${slot.id}`}>
                <Input
                  id={`sort-${slot.id}`}
                  name="sortOrder"
                  type="number"
                  dir="ltr"
                  defaultValue={slot.sortOrder}
                />
              </Field>
            </div>
          </SettingsForm>
        </div>
      ) : null}
    </div>
  )
}
