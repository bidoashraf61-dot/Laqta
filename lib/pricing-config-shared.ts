import type { PricingConfig } from '@/lib/price-calculator'

/**
 * The pure half of the pricing settings (DEV-09c): the grade tables, the
 * dropdown choices and the arithmetic from choices to calculator numbers.
 * No database, so the admin panel runs it in the browser to show a live
 * example. The loader and saver are in `lib/pricing-config.ts`.
 */

export const GRADES = ['low', 'medium', 'high'] as const
export type Grade = (typeof GRADES)[number]

export const RESOLUTION_GRADES: Record<Grade, PricingConfig['resolution']> = {
  low: { sd720: 0.8, hd1080: 1.0, uhd4k: 1.15 },
  medium: { sd720: 0.6, hd1080: 1.0, uhd4k: 1.3 },
  high: { sd720: 0.5, hd1080: 1.0, uhd4k: 1.5 },
}
export const TYPE_GRADES: Record<Grade, PricingConfig['type']> = {
  low: { ai_animated_2d: 0.9, ai_animated_3d: 0.95, ai_live_action: 1.0, filmed: 1.1 },
  medium: { ai_animated_2d: 0.8, ai_animated_3d: 0.9, ai_live_action: 1.0, filmed: 1.25 },
  high: { ai_animated_2d: 0.65, ai_animated_3d: 0.8, ai_live_action: 1.0, filmed: 1.5 },
}
export const QUALITY_GRADES: Record<Grade, PricingConfig['quality']> = {
  low: { standard: 0.95, good: 1.0, exceptional: 1.05 },
  medium: { standard: 0.9, good: 1.0, exceptional: 1.15 },
  high: { standard: 0.8, good: 1.0, exceptional: 1.3 },
}

export const PRICE_MIN_CHOICES = [29, 49, 69] as const
export const PRICE_MAX_CHOICES = [199, 249, 299] as const
export const SPREAD_CHOICES = [0.1, 0.15, 0.2] as const

/** What the row stores — the owner's choices, not derived numbers. */
export type PricingChoices = {
  resolution: Grade
  type: Grade
  quality: Grade
  priceMin: (typeof PRICE_MIN_CHOICES)[number]
  priceMax: (typeof PRICE_MAX_CHOICES)[number]
  spread: (typeof SPREAD_CHOICES)[number]
}

export const DEFAULT_CHOICES: PricingChoices = {
  resolution: 'medium',
  type: 'medium',
  quality: 'medium',
  priceMin: 49,
  priceMax: 249,
  spread: 0.15,
}

const oneOf = <T>(value: unknown, choices: readonly T[], fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback

/** The row's JSON as choices; anything unknown falls back to the default. */
export function readChoices(raw: unknown): PricingChoices {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    resolution: oneOf(source.resolution, GRADES, DEFAULT_CHOICES.resolution),
    type: oneOf(source.type, GRADES, DEFAULT_CHOICES.type),
    quality: oneOf(source.quality, GRADES, DEFAULT_CHOICES.quality),
    priceMin: oneOf(source.priceMin, PRICE_MIN_CHOICES, DEFAULT_CHOICES.priceMin),
    priceMax: oneOf(source.priceMax, PRICE_MAX_CHOICES, DEFAULT_CHOICES.priceMax),
    spread: oneOf(source.spread, SPREAD_CHOICES, DEFAULT_CHOICES.spread),
  }
}

/** The numbers the calculator runs on, from the owner's choices. */
export function toConfig(choices: PricingChoices): PricingConfig {
  return {
    priceMin: choices.priceMin,
    priceMax: choices.priceMax,
    spread: choices.spread,
    resolution: RESOLUTION_GRADES[choices.resolution],
    type: TYPE_GRADES[choices.type],
    quality: QUALITY_GRADES[choices.quality],
  }
}

/** Read the editor's dropdowns. Any value not in its list is refused. */
export function parsePricingForm(
  formData: FormData,
): { ok: true; choices: PricingChoices } | { ok: false; error: 'dash.pricing.invalid' } {
  const get = (name: string) => String(formData.get(name) ?? '')
  const grade = (name: string) => (GRADES as readonly string[]).includes(get(name)) ? (get(name) as Grade) : null
  const number = <T extends number>(name: string, choices: readonly T[]) => {
    const value = Number(get(name))
    return choices.includes(value as T) ? (value as T) : null
  }
  const choices = {
    resolution: grade('resolution'),
    type: grade('type'),
    quality: grade('quality'),
    priceMin: number('priceMin', PRICE_MIN_CHOICES),
    priceMax: number('priceMax', PRICE_MAX_CHOICES),
    spread: number('spread', SPREAD_CHOICES),
  }
  if (Object.values(choices).some((value) => value === null)) return { ok: false, error: 'dash.pricing.invalid' }
  return { ok: true, choices: choices as PricingChoices }
}
