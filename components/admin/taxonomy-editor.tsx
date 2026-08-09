'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/label'
import { Input, NativeSelect } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/toggles'
import { SettingsForm } from '@/components/dashboard/form'
import { saveTaxonomy } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

export type TermValue = {
  id?: string
  kind: string
  slug: string
  nameAr: string
  nameEn: string
  synonymsAr: string[]
  synonymsEn: string[]
  parentId: string | null
  sortOrder: number
  isActive: boolean
}

export type ParentOption = { id: string; nameAr: string; kind: string }

/**
 * Create or edit a taxonomy term.
 *
 * The synonyms are the point of this form, not the name. They are what lets an
 * Arabic query reach English-tagged footage ("AlUla" ↔ "العلا") and what makes
 * hamza and alef variants match, so both synonym fields sit above the fold
 * rather than tucked under an "advanced" heading.
 */
export function TaxonomyEditor({
  term,
  parents,
  trigger,
}: {
  term?: TermValue
  parents: ParentOption[]
  trigger?: 'add' | 'edit'
}) {
  const t = useT()

  const [open, setOpen] = useState(false)
  const id = term?.id ?? 'new'

  return (
    <div className={trigger === 'add' ? '' : 'w-full'}>
      <Button
        type="button"
        variant={trigger === 'add' ? 'gold' : 'ghost'}
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger === 'add' ? <Plus /> : <Pencil className="size-3.5" />}
        {trigger === 'add' ? t('dash.addTerm') : t('actions.edit')}
      </Button>

      {open ? (
        <div className="mt-3 rounded-md border border-border/60 bg-background p-4">
          <SettingsForm action={saveTaxonomy}>
            {term?.id ? <input type="hidden" name="id" value={term.id} /> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('dash.termAr')} htmlFor={`nameAr-${id}`} required>
                <Input
                  id={`nameAr-${id}`}
                  name="nameAr"
                  required
                  maxLength={80}
                  defaultValue={term?.nameAr ?? ''}
                />
              </Field>
              <Field label={t('dash.termEn')} htmlFor={`nameEn-${id}`} required>
                <Input
                  id={`nameEn-${id}`}
                  name="nameEn"
                  required
                  maxLength={80}
                  dir="ltr"
                  defaultValue={term?.nameEn ?? ''}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('dash.kindCategory')} htmlFor={`kind-${id}`} required>
                <NativeSelect
                  id={`kind-${id}`}
                  name="kind"
                  required
                  defaultValue={term?.kind ?? 'category'}
                >
                  <option value="category">{t('dash.kindCategory')}</option>
                  <option value="location">{t('dash.kindLocation')}</option>
                  <option value="tag">{t('dash.kindTag')}</option>
                  <option value="theme">{t('dash.kindTheme')}</option>
                </NativeSelect>
              </Field>
              <Field label={t('dash.termSlug')} htmlFor={`slug-${id}`} required>
                <Input
                  id={`slug-${id}`}
                  name="slug"
                  required
                  dir="ltr"
                  pattern="[a-z0-9][a-z0-9\-]*"
                  defaultValue={term?.slug ?? ''}
                />
              </Field>
              <Field label={t('dash.termParent')} htmlFor={`parent-${id}`}>
                <NativeSelect
                  id={`parent-${id}`}
                  name="parentId"
                  defaultValue={term?.parentId ?? ''}
                >
                  <option value="">{t('dash.termNone')}</option>
                  {parents
                    .filter((parent) => parent.id !== term?.id)
                    .map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.nameAr}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            </div>

            <Field
              label={`${t('dash.termSynonyms')} — ${t('dash.termAr')}`}
              htmlFor={`synAr-${id}`}
              hint={t('dash.taxonomyHint')}
            >
              <Input
                id={`synAr-${id}`}
                name="synonymsAr"
                defaultValue={term?.synonymsAr.join('، ') ?? ''}
              />
            </Field>

            <Field
              label={`${t('dash.termSynonyms')} — ${t('dash.termEn')}`}
              htmlFor={`synEn-${id}`}
            >
              <Input
                id={`synEn-${id}`}
                name="synonymsEn"
                dir="ltr"
                defaultValue={term?.synonymsEn.join(', ') ?? ''}
              />
            </Field>

            <div className="flex flex-wrap items-end gap-6">
              <Field label={t('dash.sortOrder')} htmlFor={`sort-${id}`} className="w-28">
                <Input
                  id={`sort-${id}`}
                  name="sortOrder"
                  type="number"
                  dir="ltr"
                  defaultValue={term?.sortOrder ?? 0}
                />
              </Field>
              <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm">
                <Checkbox name="isActive" defaultChecked={term?.isActive ?? true} value="on" />
                {t('dash.slotActive')}
              </label>
            </div>
          </SettingsForm>
        </div>
      ) : null}
    </div>
  )
}
