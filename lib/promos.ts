import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Promo codes at checkout (DEV-63).
 *
 * Codes are created on /admin/promos. Until DEV-63 nothing applied them: the
 * editor worked, the buyer had no field, and `redemptions` never moved.
 *
 * ── The rules a code enforces ───────────────────────────────────────────────
 * active; inside `startsAt`–`endsAt`; `redemptions < maxRedemptions`; the cart
 * subtotal (before discount) ≥ `minOrderTotal`; and when `albumIds` is not
 * empty, only those albums are discounted — a code for other albums fails.
 *
 * ── Where the money goes ────────────────────────────────────────────────────
 * The discount is split across the eligible lines in proportion to their
 * price (a `fixed` code) or taken per line (a `percent` code), rounded to the
 * cent with the remainder on the last line so the parts sum exactly. Each
 * line's paid price is what commission, VAT, the creator ledger and any refund
 * run on — the creator is paid on the price actually paid.
 *
 * ── Redemptions ─────────────────────────────────────────────────────────────
 * Counted when the order is placed, atomically against the cap (`redeem`), so
 * two buyers cannot both take the last use. An order placed and never paid
 * still used its redemption — the admin sees it on /admin/promos.
 */

export type PromoError =
  | 'promo.notFound'
  | 'promo.notActiveNow'
  | 'promo.exhausted'
  | 'promo.minimum'
  | 'promo.notApplicable'

export type PromoLine = { albumId: string; gross: number }

export type PromoResult =
  | {
      ok: true
      promoId: string
      code: string
      /** Per album id: the discount on that line. Every line has an entry. */
      discounts: Record<string, number>
      total: number
    }
  | { ok: false; error: PromoError; vars?: Record<string, string | number> }

const cents = (value: number) => Math.round(value * 100) / 100

export function normaliseCode(raw: unknown) {
  return String(raw ?? '').trim().toUpperCase()
}

export async function evaluatePromo(
  rawCode: string,
  lines: PromoLine[],
  now = new Date(),
  client: Prisma.TransactionClient | typeof db = db,
): Promise<PromoResult> {
  const code = normaliseCode(rawCode)
  if (!code) return { ok: false, error: 'promo.notFound' }
  const promo = await client.promoCode.findUnique({ where: { code } })
  if (!promo || !promo.isActive) return { ok: false, error: 'promo.notFound' }
  if ((promo.startsAt && promo.startsAt > now) || (promo.endsAt && promo.endsAt < now)) {
    return { ok: false, error: 'promo.notActiveNow' }
  }
  if (promo.maxRedemptions !== null && promo.redemptions >= promo.maxRedemptions) {
    return { ok: false, error: 'promo.exhausted' }
  }

  const subtotal = cents(lines.reduce((sum, line) => sum + line.gross, 0))
  if (promo.minOrderTotal !== null && subtotal < Number(promo.minOrderTotal)) {
    return { ok: false, error: 'promo.minimum', vars: { amount: Number(promo.minOrderTotal) } }
  }

  const eligible = lines.filter((line) => promo.albumIds.length === 0 || promo.albumIds.includes(line.albumId))
  const eligibleTotal = cents(eligible.reduce((sum, line) => sum + line.gross, 0))
  if (eligible.length === 0 || eligibleTotal <= 0) return { ok: false, error: 'promo.notApplicable' }

  const value = Number(promo.value)
  const wanted =
    promo.kind === 'percent'
      ? cents((eligibleTotal * Math.min(100, Math.max(0, value))) / 100)
      : cents(Math.min(Math.max(0, value), eligibleTotal))

  const discounts: Record<string, number> = Object.fromEntries(lines.map((line) => [line.albumId, 0]))
  let given = 0
  eligible.forEach((line, index) => {
    const share =
      index === eligible.length - 1 ? cents(wanted - given) : cents((wanted * line.gross) / eligibleTotal)
    discounts[line.albumId] = Math.min(line.gross, Math.max(0, share))
    given = cents(given + discounts[line.albumId])
  })

  return { ok: true, promoId: promo.id, code: promo.code, discounts, total: given }
}

/**
 * Take one use of the code, inside the order's transaction. False when the
 * cap was reached between evaluating and placing the order.
 */
export async function redeem(tx: Prisma.TransactionClient, promoId: string) {
  const updated = await tx.$executeRaw`
    UPDATE "PromoCode"
    SET "redemptions" = "redemptions" + 1, "updatedAt" = NOW()
    WHERE "id" = ${promoId}
      AND "isActive" = true
      AND ("maxRedemptions" IS NULL OR "redemptions" < "maxRedemptions")`
  return updated === 1
}
