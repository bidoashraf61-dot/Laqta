import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'

export type RegularPriceError =
  | { key: 'state.notFound' }
  | { key: 'dash.price.notLive' }
  | { key: 'dash.price.invalid' }
  | { key: 'dash.price.belowOffer'; vars: { price: number } }

/**
 * Set an album's REGULAR price by hand (DEV-61) — the owner's special price.
 *
 * Any amount above zero, up to 100,000, whole cents; outside the calculator's
 * range if the owner chooses (that range governs approval, not this). Live
 * and paused albums only — a draft or an album in review is priced at
 * approval. A set offer must stay below the regular price, so a price at or
 * under it is refused. Past orders keep the gross they paid. Audited.
 */
export async function setRegularPrice(input: {
  albumId: string
  price: unknown
  reason?: string | null
  actorId: string
}): Promise<{ ok: true } | { ok: false; error: RegularPriceError }> {
  const album = await db.album.findUnique({
    where: { id: input.albumId },
    select: { status: true, priceStandard: true, offerPrice: true },
  })
  if (!album) return { ok: false, error: { key: 'state.notFound' } }
  if (album.status !== 'live' && album.status !== 'paused') return { ok: false, error: { key: 'dash.price.notLive' } }

  const price = Number(String(input.price ?? '').trim())
  if (!Number.isFinite(price) || price <= 0 || price > 100_000 || Math.round(price * 100) !== price * 100) {
    return { ok: false, error: { key: 'dash.price.invalid' } }
  }
  if (album.offerPrice !== null && price <= Number(album.offerPrice)) {
    return { ok: false, error: { key: 'dash.price.belowOffer', vars: { price: Number(album.offerPrice) } } }
  }

  const reason = String(input.reason ?? '').trim().slice(0, 300) || null
  await db.album.update({ where: { id: input.albumId }, data: { priceStandard: price } })
  await recordAudit({
    actorId: input.actorId,
    action: 'album.price.set',
    entity: 'Album',
    entityId: input.albumId,
    detail: { from: Number(album.priceStandard), to: price, reason },
  })
  return { ok: true }
}
