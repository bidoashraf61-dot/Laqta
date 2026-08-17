/**
 * One-time currency redenomination: SAR → USD.
 *
 *   npm run db:to-usd
 *
 * Prices are now quoted in USD per album. This converts every existing money
 * column by the SAR→USD peg (÷3.75) in a single transaction, so every derived
 * figure — order totals, frozen commission, ledger balances, the analytics
 * rollup — scales by the same factor and all the accounting invariants still
 * hold (a rate is a ratio; scaling both sides leaves it unchanged). Idempotent
 * it is NOT: run it once against SAR data. `currency` columns already read
 * 'USD' guard the re-run — the script refuses if the catalogue is already USD.
 *
 * New rows are seeded in USD directly (prisma/seed.ts), so this only fixes
 * data that predates the switch.
 */

import { db } from '@/lib/db'

const F = 3.75 // SAR pegged to USD

async function main() {
  const already = await db.album.findFirst({ where: { currency: 'USD' }, select: { id: true } })
  if (already) {
    console.log('Catalogue is already USD — nothing to convert.')
    return
  }

  // Prices are whole dollars; everything derived keeps cents.
  const whole = (col: string) => `ROUND(${col} / ${F})`
  const cents = (col: string) => `ROUND(${col} / ${F}, 2)`

  const statements = [
    `UPDATE "Album" SET currency='USD', "priceStandard"=${whole('"priceStandard"')}`,
    `UPDATE "PriceBand" SET currency='USD', "priceStandard"=${whole('"priceStandard"')}`,
    `UPDATE "PromoCode" SET currency='USD', value=CASE WHEN kind='fixed' THEN ${cents('value')} ELSE value END, "minOrderTotal"=${cents('"minOrderTotal"')}`,
    `UPDATE "CartItem" SET "unitPrice"=${cents('"unitPrice"')}, "vatAmount"=${cents('"vatAmount"')}`,
    `UPDATE "Order" SET currency='USD', subtotal=${cents('subtotal')}, "vatAmount"=${cents('"vatAmount"')}, total=${cents('total')}, "refundedAmount"=${cents('"refundedAmount"')}`,
    `UPDATE "OrderItem" SET "grossAmount"=${cents('"grossAmount"')}, "vatAmount"=${cents('"vatAmount"')}, "commissionAmount"=${cents('"commissionAmount"')}, "creatorNetAmount"=${cents('"creatorNetAmount"')}, "refundedAmount"=${cents('"refundedAmount"')}`,
    `UPDATE "Refund" SET amount=${cents('amount')}, "vatAmount"=${cents('"vatAmount"')}`,
    `UPDATE "RefundLine" SET "grossAmount"=${cents('"grossAmount"')}, "vatAmount"=${cents('"vatAmount"')}, "commissionReversed"=${cents('"commissionReversed"')}, "creatorNetReversed"=${cents('"creatorNetReversed"')}`,
    `UPDATE "Chargeback" SET amount=${cents('amount')}`,
    `UPDATE "CreatorLedger" SET currency='USD', amount=${cents('amount')}, "balanceAfter"=${cents('"balanceAfter"')}`,
    `UPDATE "Payout" SET currency='USD', amount=${cents('amount')}, "netAmount"=${cents('"netAmount"')}, "withholdingAmount"=${cents('"withholdingAmount"')}`,
    `UPDATE "PayoutRun" SET "totalAmount"=${cents('"totalAmount"')}`,
    `UPDATE "Creator" SET "lifetimeGmv"=${cents('"lifetimeGmv"')}, "balanceHeld"=${cents('"balanceHeld"')}, "balanceAvail"=${cents('"balanceAvail"')}`,
    `UPDATE "AlbumStat" SET revenue=${cents('revenue')}`,
  ]

  await db.$transaction(statements.map((sql) => db.$executeRawUnsafe(sql)))
  console.log(`Redenominated ${statements.length} tables SAR → USD (÷${F}).`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
