import { db } from '@/lib/db'
import type { PricingConfig } from '@/lib/price-calculator'
import { readChoices, toConfig, type PricingChoices } from '@/lib/pricing-config-shared'
export * from '@/lib/pricing-config-shared'

/**
 * The owner's pricing parameters (DEV-09c) — read from the one
 * `PricingSetting` row, edited on /admin/catalogue.
 *
 * ── Grades, not numbers (owner, 2026-09-27) ─────────────────────────────────
 * The owner does not type multipliers. Each aspect — resolution, footage type,
 * quality — has one IMPORTANCE grade (low / medium / high): how much that
 * aspect moves the price. Each grade is a fixed set of multipliers below;
 * "medium" is exactly the values agreed on 2026-09-27, so the default changes
 * nothing. The price limits and the creator's margin are dropdowns of three
 * choices too.
 *
 * ── What a change reaches ───────────────────────────────────────────────────
 * The calculator on every creator's album details form, the range a
 * recommendation must fall in when it is saved and when the album is
 * submitted, the range the owner may approve or propose in, the band editor's
 * price limits and the /sell FAQ. NOT any album already live (its price was
 * frozen at approval) and never a completed order.
 *
 * Unknown or missing values fall back to the defaults, so a broken row never
 * breaks pricing. `verify:pricing` asserts the default choices produce exactly
 * `DEFAULT_PRICING`.
 */

export async function loadPricingChoices(): Promise<PricingChoices> {
  const row = await db.pricingSetting.findUnique({ where: { id: 'default' }, select: { config: true } })
  return readChoices(row?.config)
}

export async function loadPricingConfig(): Promise<PricingConfig> {
  return toConfig(await loadPricingChoices())
}

export async function savePricingChoices(choices: PricingChoices, adminId: string) {
  const before = await loadPricingChoices()
  await db.pricingSetting.upsert({
    where: { id: 'default' },
    update: { config: choices, updatedById: adminId },
    create: { id: 'default', config: choices, updatedById: adminId },
  })
  return before
}
