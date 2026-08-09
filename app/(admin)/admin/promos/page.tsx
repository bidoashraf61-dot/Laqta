import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/state'
import { DashboardHeader, Panel } from '@/components/dashboard/primitives'
import { ActionButton } from '@/components/dashboard/form'
import { PromoEditor, type PromoValue } from '@/components/admin/promo-editor'
import { togglePromoActive } from '@/app/(admin)/admin/actions'
import { formatDate, formatMoney, formatNumber, formatPercent, t } from '@/lib/i18n'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('dash.promos'),
  }
}

function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null
}

/**
 * Promo codes.
 *
 * Redemptions are shown against the cap because a code that has quietly run
 * out looks identical to a code that is broken from the buyer's side, and
 * that distinction is the first thing support needs.
 */
export default async function AdminPromosPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  await requireAdmin()

  const promos = await db.promoCode.findMany({ orderBy: [{ isActive: 'desc' }, { code: 'asc' }] })
  const now = new Date()

  return (
    <>
      <DashboardHeader
        title={t('dash.promosTitle')}
        description={t('dash.promosHint')}
        action={<PromoEditor />}
      />

      {promos.length === 0 ? (
        <EmptyState title={t('dash.noPromos')} description={t('dash.promosHint')} />
      ) : (
        <div className="space-y-2">
          {promos.map((promo) => {
            const scheduled =
              (!promo.startsAt || promo.startsAt <= now) && (!promo.endsAt || promo.endsAt >= now)
            const exhausted =
              promo.maxRedemptions != null && promo.redemptions >= promo.maxRedemptions
            const value: PromoValue = {
              id: promo.id,
              code: promo.code,
              kind: promo.kind,
              value: String(Number(promo.value)),
              maxRedemptions: promo.maxRedemptions,
              minOrderTotal:
                promo.minOrderTotal != null ? String(Number(promo.minOrderTotal)) : null,
              startsAt: dateInput(promo.startsAt),
              endsAt: dateInput(promo.endsAt),
              isActive: promo.isActive,
            }

            return (
              <Panel key={promo.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="ltr-island">{promo.code}</span>
                      <span className="numeric text-gold">
                        {promo.kind === 'percent'
                          ? formatPercent(Number(promo.value) / 100, 0)
                          : formatMoney(Number(promo.value), promo.currency)}
                      </span>
                      <Badge
                        variant={promo.isActive && scheduled && !exhausted ? 'success' : 'neutral'}
                      >
                        {promo.isActive
                          ? exhausted
                            ? t('dash.promoLimit')
                            : scheduled
                              ? t('dash.promoActive')
                              : t('dash.promoWindow')
                          : t('dash.promoInactive')}
                      </Badge>
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('dash.promoRedemptions')}:{' '}
                      <span className="numeric">{formatNumber(promo.redemptions)}</span>
                      {promo.maxRedemptions != null ? (
                        <span className="numeric"> / {formatNumber(promo.maxRedemptions)}</span>
                      ) : null}
                      {promo.minOrderTotal != null ? (
                        <>
                          {' · '}
                          {t('dash.promoMinOrder')}{' '}
                          <span className="numeric">
                            {formatMoney(Number(promo.minOrderTotal), promo.currency)}
                          </span>
                        </>
                      ) : null}
                      {promo.startsAt || promo.endsAt ? (
                        <>
                          {' · '}
                          <span className="numeric">
                            {promo.startsAt ? formatDate(promo.startsAt) : '—'}
                          </span>
                          {' — '}
                          <span className="numeric">
                            {promo.endsAt ? formatDate(promo.endsAt) : '—'}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <ActionButton
                    action={togglePromoActive.bind(null, promo.id, !promo.isActive)}
                    label={promo.isActive ? t('dash.promoInactive') : t('dash.promoActive')}
                  />
                </div>

                <PromoEditor promo={value} />
              </Panel>
            )
          })}
        </div>
      )}
    </>
  )
}
