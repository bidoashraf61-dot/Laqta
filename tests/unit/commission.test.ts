import { describe, it, expect } from 'vitest'
import {
  resolveCommission,
  reverseCommission,
  tierForLifetimeGmv,
  vatOn,
  TIER_RATES,
  TIER_THRESHOLDS_SAR,
  EXCLUSIVE_BONUS_POINTS,
} from '@/lib/commission'

/**
 * The commission engine.
 *
 * This is the most consequential pure function in the product: it decides what
 * the platform keeps and what the creator earns, and its result is FROZEN onto
 * the OrderItem at purchase. A bug here is a money bug that survives in the
 * ledger forever, so the arithmetic is pinned exhaustively rather than sampled.
 */

describe('tier thresholds', () => {
  it('starts every creator on standard', () => {
    expect(tierForLifetimeGmv(0)).toBe('standard')
    expect(tierForLifetimeGmv(49_999)).toBe('standard')
  })

  it('promotes at the published thresholds, inclusive', () => {
    expect(tierForLifetimeGmv(TIER_THRESHOLDS_SAR.silver)).toBe('silver')
    expect(tierForLifetimeGmv(TIER_THRESHOLDS_SAR.gold)).toBe('gold')
  })

  it('does not promote a fraction below a threshold', () => {
    expect(tierForLifetimeGmv(TIER_THRESHOLDS_SAR.silver - 0.01)).toBe('standard')
    expect(tierForLifetimeGmv(TIER_THRESHOLDS_SAR.gold - 0.01)).toBe('silver')
  })

  it('keeps gold as the ceiling', () => {
    expect(tierForLifetimeGmv(10_000_000)).toBe('gold')
  })
})

describe('resolveCommission', () => {
  it('splits a sale by the tier rate', () => {
    const result = resolveCommission({ grossAmount: 1000, tier: 'standard', isExclusive: false })
    expect(result.rate).toBe(0.35)
    expect(result.commissionAmount).toBe(350)
    expect(result.creatorNetAmount).toBe(650)
  })

  it('gives a better split at each tier', () => {
    const gross = 1000
    const standard = resolveCommission({ grossAmount: gross, tier: 'standard', isExclusive: false })
    const silver = resolveCommission({ grossAmount: gross, tier: 'silver', isExclusive: false })
    const gold = resolveCommission({ grossAmount: gross, tier: 'gold', isExclusive: false })

    expect(silver.creatorNetAmount).toBeGreaterThan(standard.creatorNetAmount)
    expect(gold.creatorNetAmount).toBeGreaterThan(silver.creatorNetAmount)
  })

  it('applies the exclusive bonus as five percentage points off the take', () => {
    const plain = resolveCommission({ grossAmount: 1000, tier: 'standard', isExclusive: false })
    const exclusive = resolveCommission({ grossAmount: 1000, tier: 'standard', isExclusive: true })

    expect(plain.rate - exclusive.rate).toBeCloseTo(EXCLUSIVE_BONUS_POINTS, 10)
    expect(exclusive.rate).toBe(TIER_RATES.standard - EXCLUSIVE_BONUS_POINTS)
  })

  it('lets an admin override beat the derived rate', () => {
    const result = resolveCommission({
      grossAmount: 1000,
      tier: 'standard',
      isExclusive: false,
      override: 0.1,
    })
    expect(result.rate).toBe(0.1)
    expect(result.commissionAmount).toBe(100)
  })

  it('clamps a nonsensical override into range', () => {
    const tooHigh = resolveCommission({
      grossAmount: 1000,
      tier: 'standard',
      isExclusive: false,
      override: 5,
    })
    const negative = resolveCommission({
      grossAmount: 1000,
      tier: 'standard',
      isExclusive: false,
      override: -1,
    })
    expect(tooHigh.rate).toBeLessThanOrEqual(0.5)
    expect(negative.rate).toBeGreaterThanOrEqual(0)
  })

  it('always splits the gross exactly — no money invented or lost', () => {
    for (const gross of [0.01, 1, 79, 199, 399, 799, 1234.56, 99_999.99]) {
      for (const tier of ['standard', 'silver', 'gold'] as const) {
        const r = resolveCommission({ grossAmount: gross, tier, isExclusive: false })
        // Rounding is to the cent on each side; the pair must still reconstruct
        // the gross, or the ledger drifts one cent at a time.
        expect(r.commissionAmount + r.creatorNetAmount).toBeCloseTo(gross, 2)
      }
    }
  })

  it('records how the rate was derived, for audit', () => {
    const r = resolveCommission({ grossAmount: 100, tier: 'silver', isExclusive: true })
    expect(r.basis.tier).toBe('silver')
    expect(r.basis.baseRate).toBe(TIER_RATES.silver)
    expect(r.basis.exclusiveBonus).toBe(EXCLUSIVE_BONUS_POINTS)
    expect(r.basis.effectiveRate).toBe(r.rate)
  })
})

describe('reverseCommission — the frozen-rate rule', () => {
  it('reverses a full refund to exactly the original split', () => {
    const sale = resolveCommission({ grossAmount: 1000, tier: 'standard', isExclusive: false })
    const reversal = reverseCommission({ refundGross: 1000, frozenRate: sale.rate })

    expect(reversal.commissionReversed).toBe(sale.commissionAmount)
    expect(reversal.creatorNetReversed).toBe(sale.creatorNetAmount)
  })

  it('nets the creator ledger to zero on a full refund', () => {
    const sale = resolveCommission({ grossAmount: 799, tier: 'gold', isExclusive: false })
    const reversal = reverseCommission({ refundGross: 799, frozenRate: sale.rate })
    expect(sale.creatorNetAmount - reversal.creatorNetReversed).toBe(0)
  })

  it('splits a partial refund pro-rata', () => {
    const reversal = reverseCommission({ refundGross: 500, frozenRate: 0.35 })
    expect(reversal.commissionReversed).toBe(175)
    expect(reversal.creatorNetReversed).toBe(325)
  })

  it('uses the FROZEN rate, not the creator current tier', () => {
    // Sold at standard, creator later promoted to gold. The refund must reverse
    // at 35%, not 25% — otherwise the platform silently absorbs the difference
    // and the ledger stops netting to zero.
    const soldAt = resolveCommission({ grossAmount: 1000, tier: 'standard', isExclusive: false })
    const nowAt = resolveCommission({ grossAmount: 1000, tier: 'gold', isExclusive: false })
    const correct = reverseCommission({ refundGross: 1000, frozenRate: soldAt.rate })

    expect(correct.commissionReversed).toBe(soldAt.commissionAmount)
    expect(correct.commissionReversed).not.toBe(nowAt.commissionAmount)
  })
})

describe('vatOn', () => {
  it('computes VAT at the configured rate', () => {
    expect(vatOn(100, 0.15)).toBe(15)
  })

  it('rounds to the cent', () => {
    expect(vatOn(33.33, 0.15)).toBe(5)
  })

  it('handles zero', () => {
    expect(vatOn(0, 0.15)).toBe(0)
  })
})
