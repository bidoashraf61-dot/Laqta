import { db } from '@/lib/db'

/**
 * One-off backfills for columns added after the database was first seeded.
 *
 * The seed is not idempotent — it writes orders with unique order numbers and
 * fails on a second run — so an existing database cannot simply be re-seeded to
 * pick up a new column.
 */
const OFFERS: Record<string, string> = {
  'عرض الإطلاق': 'Launch offer',
  'عرض محدود': 'Limited offer',
}

/**
 * Keyed by handle, not by the old value: splitting `city` into `cityAr`/`cityEn`
 * dropped the original column, so there is nothing left to match on.
 */
const CITIES: Record<string, [string, string]> = {
  'yousef-shami': ['القاهرة', 'Cairo'],
  'nada-otaibi': ['الرياض', 'Riyadh'],
}

async function main() {
  for (const [ar, en] of Object.entries(OFFERS)) {
    const r = await db.album.updateMany({ where: { offerLabelAr: ar }, data: { offerLabelEn: en } })
    console.log(`offer  ${ar} -> ${en}: ${r.count}`)
  }
  for (const [handle, [ar, en]] of Object.entries(CITIES)) {
    const r = await db.creator.updateMany({ where: { handle }, data: { cityAr: ar, cityEn: en } })
    console.log(`city   ${handle} -> ${ar} / ${en}: ${r.count}`)
  }
}

main().finally(() => db.$disconnect())
