import { CreatorTier } from '@prisma/client'

/**
 * Commission engine.
 *
 * Published rates (docs/business/saudi-stock-footage-portal-plan.md §9):
 *
 *   Standard  default              35% platform take
 *   Silver    USD 12.5k lifetime   30%
 *   Gold      USD 50k lifetime     25%
 *   Exclusive album                −5 percentage points
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * `resolveCommission` runs ONCE, at purchase, and its result is written to the
 * OrderItem. Refunds, payouts, ledger entries and reports all read the frozen
 * `commissionRate` / `commissionAmount` off the OrderItem. Nothing downstream
 * may call this function again for an existing order — a creator promoted to
 * Gold in March must not retroactively change what they earned in January.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const TIER_RATES: Record<CreatorTier, number> = {
  standard: 0.35,
  silver: 0.3,
  gold: 0.25,
}

/**
 * Promotion thresholds, in USD of lifetime GMV.
 *
 * These were SAR figures (50k / 200k) and stayed SAR through the move to USD
 * pricing, while `Creator.lifetimeGmv` was redenominated with everything else —
 * so a creator was suddenly being measured in dollars against a riyal bar and
 * promotion became 3.75× harder overnight.
 *
 * Converted at the peg and rounded DOWN to clean figures, so the change can
 * only help: $12,500 is below SAR 50,000 (~$13,333) and $50,000 is below
 * SAR 200,000 (~$53,333). Nobody loses a tier they had already earned.
 */
export const TIER_THRESHOLDS_USD: Record<CreatorTier, number> = {
  standard: 0,
  silver: 12_500,
  gold: 50_000,
}

export const EXCLUSIVE_BONUS_POINTS = 0.05

/** Floor/ceiling guard so an override can't produce a nonsensical split. */
const MIN_RATE = 0
const MAX_RATE = 0.5

export type CommissionBasis = {
  tier: CreatorTier
  baseRate: number
  exclusiveBonus: number
  override: number | null
  effectiveRate: number
}

export type CommissionResult = {
  rate: number
  commissionAmount: number
  creatorNetAmount: number
  basis: CommissionBasis
}

export function tierForLifetimeGmv(lifetimeGmv: number): CreatorTier {
  if (lifetimeGmv >= TIER_THRESHOLDS_USD.gold) return 'gold'
  if (lifetimeGmv >= TIER_THRESHOLDS_USD.silver) return 'silver'
  return 'standard'
}

/**
 * Compute the platform take for one album sale.
 *
 * @param grossAmount  ex-VAT sale value of the line
 * @param isExclusive  the *album's* exclusivity flag, not the creator's
 * @param override     admin per-creator override as a fraction, or null
 */
export function resolveCommission({
  grossAmount,
  tier,
  isExclusive,
  override = null,
}: {
  grossAmount: number
  tier: CreatorTier
  isExclusive: boolean
  override?: number | null
}): CommissionResult {
  const baseRate = TIER_RATES[tier]
  const exclusiveBonus = isExclusive ? EXCLUSIVE_BONUS_POINTS : 0

  const derived = baseRate - exclusiveBonus
  const raw = override ?? derived
  const effectiveRate = round4(clamp(raw, MIN_RATE, MAX_RATE))

  const commissionAmount = round2(grossAmount * effectiveRate)
  const creatorNetAmount = round2(grossAmount - commissionAmount)

  return {
    rate: effectiveRate,
    commissionAmount,
    creatorNetAmount,
    basis: {
      tier,
      baseRate,
      exclusiveBonus,
      override,
      effectiveRate,
    },
  }
}

/**
 * Reverse a refund against the FROZEN rate on the OrderItem.
 *
 * Deliberately takes the rate as an argument rather than the creator: the
 * caller must pass `orderItem.commissionRate`, never a freshly resolved one.
 * A partial refund reverses commission and creator net pro-rata, so the
 * ledger nets to zero on a full refund.
 */
export function reverseCommission({
  refundGross,
  frozenRate,
}: {
  refundGross: number
  frozenRate: number
}) {
  const commissionReversed = round2(refundGross * frozenRate)
  const creatorNetReversed = round2(refundGross - commissionReversed)
  return { commissionReversed, creatorNetReversed }
}

export function vatOn(amountExVat: number, rate = Number(process.env.VAT_RATE ?? 0.15)) {
  return round2(amountExVat * rate)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}
