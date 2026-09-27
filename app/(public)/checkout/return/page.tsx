import { redirect } from 'next/navigation'
import { CheckCircle2, CircleAlert, SearchX } from 'lucide-react'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'
import { localePath } from '@/lib/locale'
import { requestLocale } from '@/lib/locale-request'
import { hmacMatches, paymobConfig, redirectHmac } from '@/lib/paymob'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/components/ui/link'
import { PageTitle } from '@/components/ui/typography'
import { ReturnPending } from '@/components/checkout/return-pending'

export async function generateMetadata(): Promise<Metadata> {
  await requestLocale()
  return {
    title: t('checkout.returnTitle'),
    description: t('brand.seo.checkoutReturn'),
    robots: { index: false, follow: false },
  }
}

type State = 'paid' | 'pending' | 'failed' | 'unknown'

/**
 * Where Paymob's hosted checkout sends the buyer back.
 *
 * ── This page READS; it never settles ───────────────────────────────────────
 * The query string is the buyer's browser repeating what Paymob told it, and a
 * browser can say anything. The order becomes paid only when the signed server
 * callback lands (app/api/payments/paymob → settleOrder). So:
 *
 *   - paid     — the ORDER says so. The only source of that word here.
 *   - failed   — the server already recorded a declined attempt, or the
 *                redirect's own HMAC verifies and says success=false.
 *   - pending  — anything else. The callback usually lands within seconds of
 *                the redirect, so the page refreshes itself for a minute.
 *   - unknown  — no order number, or not this buyer's order.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await requestLocale()

  const raw = await searchParams
  const query: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(raw)) {
    query[key] = Array.isArray(value) ? value[0] : value
  }

  const session = await auth()
  if (!session?.user) {
    const back = new URLSearchParams(query as Record<string, string>).toString()
    const returnTo = `${localePath(locale, '/checkout/return')}${back ? `?${back}` : ''}`
    redirect(`${localePath(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(returnTo)}`)
  }

  // Paymob echoes our `special_reference` as `merchant_order_id`. If a
  // redirect ever arrives without it, fall back to this buyer's latest hosted
  // payment from the last two hours — never to anyone else's order.
  const orderNumber = query.merchant_order_id
  const order = await db.order.findFirst({
    where: orderNumber
      ? { orderNumber, userId: session.user.id }
      : {
          userId: session.user.id,
          paymentMethod: { in: ['card', 'apple_pay'] },
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      status: true,
      paymentEvents: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { outcome: true },
      },
    },
  })

  let state: State = 'pending'
  if (!order) {
    state = 'unknown'
  } else if (order.status === 'paid') {
    state = 'paid'
  } else if (order.status === 'failed' || order.paymentEvents[0]?.outcome === 'declined') {
    state = 'failed'
  } else {
    const config = paymobConfig()
    const signed =
      config !== null && hmacMatches(query.hmac, redirectHmac(query, config.hmacSecret))
    if (signed && query.success === 'false' && query.pending !== 'true') state = 'failed'
  }

  return (
    <div className="container max-w-3xl py-10">
      <PageTitle className="mb-6">{t('checkout.returnTitle')}</PageTitle>

      <Card>
        <CardContent className="space-y-4 p-6 text-center" aria-live="polite">
          {state === 'paid' ? (
            <>
              <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
              <h2 className="text-xl font-bold">{t('checkout.returnPaidTitle')}</h2>
              <OrderNumber value={order?.orderNumber} />
              <p className="text-muted-foreground">{t('checkout.returnPaidBody')}</p>
              <Button asChild variant="gold">
                <Link href="/account/library">{t('checkout.goToLibrary')}</Link>
              </Button>
            </>
          ) : null}

          {state === 'pending' ? (
            <>
              <h2 className="text-xl font-bold">{t('checkout.returnPendingTitle')}</h2>
              <OrderNumber value={order?.orderNumber} />
              <ReturnPending />
            </>
          ) : null}

          {state === 'failed' ? (
            <>
              <CircleAlert className="mx-auto size-10 text-clay" aria-hidden />
              <h2 className="text-xl font-bold">{t('checkout.returnFailedTitle')}</h2>
              <OrderNumber value={order?.orderNumber} />
              <p className="text-muted-foreground">{t('checkout.returnFailedBody')}</p>
              <Button asChild variant="gold">
                <Link href="/cart">{t('checkout.backToCart')}</Link>
              </Button>
            </>
          ) : null}

          {state === 'unknown' ? (
            <>
              <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden />
              <h2 className="text-xl font-bold">{t('checkout.returnUnknownTitle')}</h2>
              <p className="text-muted-foreground">{t('checkout.returnUnknownBody')}</p>
              <Button asChild variant="outline">
                <Link href="/account/purchases">{t('checkout.viewPurchases')}</Link>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function OrderNumber({ value }: { value?: string }) {
  if (!value) return null
  return (
    <p className="text-sm text-muted-foreground">
      {t('checkout.orderNumber')}: <span className="numeric">{value}</span>
    </p>
  )
}
