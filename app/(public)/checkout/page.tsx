import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getCart } from '../cart/actions'
import { availableMethods } from '@/lib/payments'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { formatMoney, t } from '@/lib/i18n'

export const metadata = { title: t('checkout.title') }

export default async function CheckoutPage() {
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
      <h1 className="mb-6 text-headline font-semibold">{t('checkout.title')}</h1>

      <div className="mb-6 space-y-1 rounded-lg border bg-card p-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-4 text-sm">
            <span className="truncate">{item.album.titleAr}</span>
            <span className="numeric">{formatMoney(Number(item.unitPrice), currency)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-2 text-sm text-muted-foreground">
          <span>{t('cart.vat')}</span>
          <span className="numeric">{formatMoney(cart.vatAmount, currency)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1">
          <span className="font-semibold">{t('cart.total')}</span>
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
