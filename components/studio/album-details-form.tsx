'use client'

import { useState, type ReactNode } from 'react'
import { SettingsForm } from '@/components/dashboard/form'
import type { ActionResult } from '@/components/dashboard/form'
import type { AlbumDetailsView, DetailsOption } from '@/lib/album-details'
import { suggestPrice, type FootageType, type Quality, type Resolution } from '@/lib/price-calculator'
import { Input, Textarea } from '@/components/ui/input'
import { formatMoneyIn } from '@/lib/i18n'
import { useLocale, useT } from '@/lib/i18n-client'
import { cn } from '@/lib/utils'

/**
 * The album details form (DEV-08) — the creator's on `/studio/albums/[id]`,
 * the reviewer's on `/admin/review/[id]`. Same fields, different action.
 *
 * Choices are native radios and checkboxes inside their labels, so keyboard,
 * screen readers and form posting all work without a script; the visible pill
 * or card is the label, and it shows focus through `has-[:focus-visible]`.
 * Nothing here is gold: the submit button is the form's one gold voice.
 *
 * `readOnly` (an album in review or live, for its creator) renders the same
 * fields disabled, with no submit — the creator sees what the reviewer sees.
 */
export function AlbumDetailsForm({
  view,
  action,
  readOnly = false,
}: {
  view: AlbumDetailsView
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>
  readOnly?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const { options, current } = view
  // The three pricing inputs drive the live suggestion, so they are state.
  const [type, setType] = useState<FootageType | null>(current.type)
  const [resolution, setResolution] = useState<Resolution | null>(current.resolution)
  const [quality, setQuality] = useState<Quality | null>(current.quality)
  const suggestion =
    type && resolution && quality
      ? suggestPrice({ clipCount: view.clipCount, type, resolution, quality, bands: view.bands })
      : null
  const money = (value: number) => formatMoneyIn(locale, value)

  const fields = (
    <fieldset disabled={readOnly} className="min-w-0 space-y-7 disabled:opacity-80">
      <Group legend={t('studio.details.origin')} required>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['ai_live_action', 'ai_animated_3d', 'ai_animated_2d', 'filmed'] as const).map((value) => (
            <Card
              key={value}
              name="type"
              value={value}
              checked={current.type === value}
              onSelect={() => setType(value)}
              required
            >
              {t(`studio.details.type.${value}`)}
            </Card>
          ))}
        </div>
      </Group>

      <Group legend={t('studio.details.resolution')} required>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['sd720', 'hd1080', 'uhd4k'] as const).map((value) => (
            <Card
              key={value}
              name="resolution"
              value={value}
              checked={current.resolution === value}
              onSelect={() => setResolution(value)}
              required
            >
              <span className="numeric">{t(`studio.details.res.${value}`)}</span>
            </Card>
          ))}
        </div>
      </Group>

      <Group legend={t('studio.details.quality')} required>
        <p className="-mt-1 mb-2 text-xs text-muted-foreground">{t('studio.details.qualityHint')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['standard', 'good', 'exceptional'] as const).map((value) => (
            <Card
              key={value}
              name="quality"
              value={value}
              checked={current.quality === value}
              onSelect={() => setQuality(value)}
              required
            >
              {t(`studio.details.q.${value}`)}
            </Card>
          ))}
        </div>
      </Group>

      <Group legend={t('studio.details.orientation')} required>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card name="orientation" value="landscape" checked={current.orientation === 'landscape'} required>
            {t('studio.details.landscape')}
          </Card>
          <Card name="orientation" value="portrait" checked={current.orientation === 'portrait'} required>
            {t('studio.details.portrait')}
          </Card>
        </div>
      </Group>

      <div className="space-y-2">
        <label htmlFor="details-category" className="text-sm font-medium">
          {t('studio.details.category')} <span className="text-destructive">*</span>
        </label>
        <select
          id="details-category"
          name="category"
          required
          defaultValue={current.category ?? ''}
          className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            {t('studio.details.categoryPick')}
          </option>
          {options.category.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <Chips
        legend={t('studio.details.locations')}
        hint={t('studio.details.locationsHint')}
        name="locations"
        options={options.location}
        selected={current.locations}
        required
      />
      <Chips
        legend={t('studio.details.timeOfDay')}
        name="tags"
        options={options.timeOfDay}
        selected={current.tags}
      />
      <Chips
        legend={t('studio.details.themes')}
        hint={t('studio.details.themesHint')}
        name="themes"
        options={options.theme}
        selected={current.themes}
      />
      <Chips
        legend={t('studio.details.style')}
        name="tags"
        options={options.tag}
        selected={current.tags}
      />

      {/* The calculator (owner, 2026-09-27): shown as soon as the three
          pricing inputs are chosen, recomputed on every change. */}
      <section aria-labelledby="price-calc" className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
        <h3 id="price-calc" className="text-sm font-medium">
          {t('studio.details.priceTitle')}
        </h3>
        {suggestion ? (
          <div aria-live="polite" className="space-y-1">
            <p className="text-sm">
              {t('studio.details.suggested')}{' '}
              <span className="numeric text-base font-bold">{money(suggestion.price)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('studio.details.range')}{' '}
              <span className="numeric">
                {money(suggestion.low)} – {money(suggestion.high)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {view.clipCount < 30
                ? t('studio.details.basisFew', { count: view.clipCount })
                : t('studio.details.basis', { count: view.clipCount })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('studio.details.pickToPrice')}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-1.5">
            <label htmlFor="details-price" className="text-sm font-medium">
              {t('studio.details.recommended')} <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="details-price"
                name="recommendedPrice"
                type="number"
                inputMode="decimal"
                min={suggestion?.low}
                max={suggestion?.high}
                step="1"
                required
                dir="ltr"
                className="numeric"
                defaultValue={current.recommendedPrice ?? undefined}
              />
              <span className="ltr-island text-sm text-muted-foreground">USD</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="details-price-note" className="text-sm font-medium">
              {t('studio.details.recommendedNote')}
            </label>
            <Textarea
              id="details-price-note"
              name="recommendedNote"
              rows={2}
              maxLength={500}
              defaultValue={current.recommendedNote ?? ''}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('studio.details.priceFinal')}</p>
      </section>

      <Group legend={t('studio.details.permits')} required>
        <div className="grid gap-2">
          <Card
            name="permitsDeclaration"
            value="none_needed"
            checked={current.permitsDeclaration === 'none_needed'}
            required
          >
            {t('studio.details.permitsNone')}
          </Card>
          <Card
            name="permitsDeclaration"
            value="attached"
            checked={current.permitsDeclaration === 'attached'}
            required
          >
            {t('studio.details.permitsAttached')}
          </Card>
        </div>
      </Group>
    </fieldset>
  )

  if (readOnly) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('studio.details.frozen')}</p>
        {fields}
      </div>
    )
  }
  return (
    <SettingsForm action={action} submitLabel={t('studio.details.save')}>
      <p className="text-sm text-muted-foreground">{t('studio.details.hint')}</p>
      {fields}
    </SettingsForm>
  )
}

function Group({ legend, required, children }: { legend: string; required?: boolean; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-sm font-medium">
        {legend} {required ? <span className="text-destructive">*</span> : null}
      </legend>
      {children}
    </fieldset>
  )
}

/** One radio as a bordered card. */
function Card({
  name,
  value,
  checked,
  required,
  onSelect,
  children,
}: {
  name: string
  value: string
  checked: boolean
  required?: boolean
  onSelect?: () => void
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm transition-colors',
        'hover:border-foreground/25 has-[:checked]:border-foreground/50 has-[:checked]:bg-accent',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        required={required}
        onChange={onSelect}
        className="mt-0.5 accent-[hsl(var(--foreground))]"
      />
      <span className="min-w-0">{children}</span>
    </label>
  )
}

/** A group of checkboxes shown as pills. */
function Chips({
  legend,
  hint,
  name,
  options,
  selected,
  required,
}: {
  legend: string
  hint?: string
  name: string
  options: DetailsOption[]
  selected: string[]
  required?: boolean
}) {
  if (options.length === 0) return null
  return (
    <Group legend={legend} required={required}>
      {hint ? <p className="-mt-1 mb-2 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.slug}
            className={cn(
              'cursor-pointer select-none rounded-full border border-input px-3 py-1.5 text-sm transition-colors',
              'hover:border-foreground/30 has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.slug}
              defaultChecked={selected.includes(option.slug)}
              className="sr-only"
            />
            {option.name}
          </label>
        ))}
      </div>
    </Group>
  )
}
