'use client'

import { useState, type ReactNode } from 'react'
import { SettingsForm } from '@/components/dashboard/form'
import { savePricingSettings } from '@/app/(admin)/admin/actions'
import { FOOTAGE_TYPES, QUALITIES, RESOLUTIONS, suggestPrice, type Band } from '@/lib/price-calculator'
import {
  GRADES,
  PRICE_MAX_CHOICES,
  PRICE_MIN_CHOICES,
  QUALITY_GRADES,
  RESOLUTION_GRADES,
  SPREAD_CHOICES,
  TYPE_GRADES,
  toConfig,
  type Grade,
  type PricingChoices,
} from '@/lib/pricing-config-shared'
import { formatMoneyIn } from '@/lib/i18n'
import { useLocale, useT } from '@/lib/i18n-client'

/**
 * The price calculator's settings — `/admin/catalogue` (DEV-09c).
 *
 * All dropdowns (owner, 2026-09-27): one importance grade per aspect
 * (resolution, footage type, quality — low / medium / high), the price limits
 * and the creator's margin. Under each grade the multipliers it stands for are
 * spelled out, and the example line recomputes with the same `suggestPrice`
 * the creator's form runs — the owner sees the effect before saving. Saving
 * reaches the next calculation only; live albums keep their approved price.
 */
export function PricingSettings({ choices, bands }: { choices: PricingChoices; bands: Band[] }) {
  const t = useT()
  const locale = useLocale()
  const [draft, setDraft] = useState(choices)
  const config = toConfig(draft)
  const money = (value: number) => formatMoneyIn(locale, value)

  const example = suggestPrice({
    clipCount: 50,
    resolution: 'uhd4k',
    type: 'ai_live_action',
    quality: 'good',
    bands,
    config,
  })

  const pick = <K extends keyof PricingChoices>(key: K, value: string) =>
    setDraft((current) => ({
      ...current,
      [key]: (typeof current[key] === 'number' ? Number(value) : value) as PricingChoices[K],
    }))

  const factors = (values: Record<string, number>, label: (key: string) => string, keys: readonly string[]) =>
    keys.map((key) => (
      // Each label is isolated: «720p» inside an Arabic line would otherwise
      // pull the multiplier to the wrong side.
      <span key={key} className="whitespace-nowrap">
        <bdi>{label(key)}</bdi>{' '}
        <span className="numeric">×{values[key]}</span>
      </span>
    ))

  return (
    <SettingsForm action={savePricingSettings} submitLabel={t('dash.pricing.save')}>
      <p className="text-xs text-muted-foreground">{t('dash.pricing.hint')}</p>

      <Select
        id="pricing-resolution"
        name="resolution"
        label={t('dash.pricing.resolutionImportance')}
        value={draft.resolution}
        onChange={(value) => pick('resolution', value)}
        options={GRADES.map((grade) => ({ value: grade, label: t(`dash.pricing.grade.${grade}`) }))}
      >
        {factors(RESOLUTION_GRADES[draft.resolution], (key) => t(`studio.details.res.${key}`), RESOLUTIONS)}
      </Select>
      <Select
        id="pricing-type"
        name="type"
        label={t('dash.pricing.typeImportance')}
        value={draft.type}
        onChange={(value) => pick('type', value)}
        options={GRADES.map((grade) => ({ value: grade, label: t(`dash.pricing.grade.${grade}`) }))}
      >
        {factors(TYPE_GRADES[draft.type as Grade], (key) => t(`studio.details.type.${key}`), FOOTAGE_TYPES)}
      </Select>
      <Select
        id="pricing-quality"
        name="quality"
        label={t('dash.pricing.qualityImportance')}
        value={draft.quality}
        onChange={(value) => pick('quality', value)}
        options={GRADES.map((grade) => ({ value: grade, label: t(`dash.pricing.grade.${grade}`) }))}
      >
        {factors(QUALITY_GRADES[draft.quality as Grade], (key) => t(`studio.details.q.${key}`), QUALITIES)}
      </Select>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          id="pricing-min"
          name="priceMin"
          label={t('dash.pricing.min')}
          value={String(draft.priceMin)}
          onChange={(value) => pick('priceMin', value)}
          options={PRICE_MIN_CHOICES.map((value) => ({ value: String(value), label: money(value) }))}
        />
        <Select
          id="pricing-max"
          name="priceMax"
          label={t('dash.pricing.max')}
          value={String(draft.priceMax)}
          onChange={(value) => pick('priceMax', value)}
          options={PRICE_MAX_CHOICES.map((value) => ({ value: String(value), label: money(value) }))}
        />
        <Select
          id="pricing-spread"
          name="spread"
          label={t('dash.pricing.spread')}
          value={String(draft.spread)}
          onChange={(value) => pick('spread', value)}
          options={SPREAD_CHOICES.map((value) => ({ value: String(value), label: `±${Math.round(value * 100)}%` }))}
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t('dash.pricing.spreadHint')}</p>

      <p aria-live="polite" className="rounded-md bg-muted/60 p-3 text-sm">
        {t('dash.pricing.example')}{' '}
        <span className="numeric font-bold">{example ? money(example.price) : '—'}</span>
        {example ? (
          <span className="block text-xs text-muted-foreground">
            {t('dash.pricing.exampleRange')}{' '}
            <span className="numeric">
              {money(example.low)} – {money(example.high)}
            </span>
          </span>
        ) : null}
      </p>
    </SettingsForm>
  )
}

function Select({
  id,
  name,
  label,
  value,
  onChange,
  options,
  children,
}: {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  children?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {children ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{children}</p>
      ) : null}
    </div>
  )
}
