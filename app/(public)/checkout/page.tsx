import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getCart } from '../cart/actions'
import { availableMethods } from '@/lib/payments'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { formatMoney, t } from '@/lib/i18n'
import { PageTitle } from '@/components/ui/typography'
import { Bilingual } from '@/components/ui/bilingual'
import type { Metadata } from 'next'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata(): Promise<Metadata> {
  // Metadata is generated outside the layout's render, so it cannot rely
  // on the layout having already resolved the locale.
  await requestLocale()

  return {
    title: t('checkout.title'),
    description: t('brand.seo.checkout'),
  }
}

export default async function CheckoutPage() {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const session = await auth()
  if (!session?.user) redirect('/sign-in?callbackUrl=/checkout')

  const cart = await getCart(session.user.id)
  if (cart.items.length === 0) redirect('/cart')

  const profile = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      billingEntityType: true,
      legalName: true,
      crNumber: true,
      vatNumber: true,
      billingAddress: true,
    },
  })

  const currency = cart.items[0]?.album.currency ?? 'SAR'

  return (
    <div className="container max-w-3xl py-10">
      <PageTitle className="mb-6">{t('checkout.title')}</PageTitle>

      <div className="mb-6 space-y-1 rounded-lg border bg-card p-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-4 text-sm">
            <span className="truncate">
              <Bilingual ar={item.album.titleAr} en={item.album.titleEn} />
            </span>
            <span className="numeric">{formatMoney(Number(item.unitPrice), currency)}</span>
          </div>
        ))}
        {cart.bundles.map((bundle) => (
          <div key={bundle.slug} className="flex justify-between gap-4 text-sm text-success">
            <span className="truncate">
              {t('cart.bundleSaving')} <Bilingual ar={bundle.titleAr} en={bundle.titleEn} />
            </span>
            <span className="numeric">−{formatMoney(bundle.discount, currency)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-2 text-sm text-muted-foreground">
          <span>{t('cart.vat')}</span>
          <span className="numeric">{formatMoney(cart.vatAmount, currency)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1">
          <span className="font-bold">{t('cart.total')}</span>
          <span className="numeric text-lg font-bold text-gold">
            {formatMoney(cart.total, currency)}
          </span>
        </div>
      </div>

      <CheckoutForm
        methods={availableMethods()}
        defaults={{
          billingEntityType: profile?.billingEntityType ?? 'individual',
          legalName: profile?.legalName ?? '',
          crNumber: profile?.crNumber ?? '',
          vatNumber: profile?.vatNumber ?? '',
        }}
      />
    </div>
  )
}
