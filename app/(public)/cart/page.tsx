import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCart } from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/toggles'
import { EmptyState } from '@/components/ui/state'
import { Bilingual } from '@/components/ui/bilingual'
import { CartLine } from '@/components/checkout/cart-line'
import { formatMoney, t } from '@/lib/i18n'

export const metadata = { title: t('cart.title') }

export default async function CartPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in?callbackUrl=/cart')

  const cart = await getCart(session.user.id)
  const currency = cart.items[0]?.album.currency ?? 'SAR'

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="mb-6 font-display text-headline font-semibold">{t('cart.title')}</h1>

      {cart.items.length === 0 ? (
        <EmptyState
          title={t('cart.empty')}
          description={t('cart.emptyHint')}
          action={
            <Button asChild variant="gold">
              <Link href="/albums">{t('cart.continueShopping')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {cart.items.map((item) => (
            <CartLine
              key={item.id}
              albumId={item.album.id}
              titleAr={item.album.titleAr}
              titleEn={item.album.titleEn}
              creatorNameAr={item.album.creator.displayNameAr}
              clipCount={item.album.clipCount}
              tier={item.licenceTier}
              unitPrice={Number(item.unitPrice)}
              currency={item.album.currency}
              editorialOnly={item.album.clearanceStatus === 'editorial_only'}
            />
          ))}

          <Card>
            <CardContent className="space-y-2 p-5">
              <Row label={t('cart.subtotal')} value={formatMoney(cart.subtotal, currency)} />
              <Row label={t('cart.vat')} value={formatMoney(cart.vatAmount, currency)} />
              <Separator className="my-2" />
              <Row label={t('cart.total')} value={formatMoney(cart.total, currency)} strong />

              <Button asChild variant="gold" size="lg" className="mt-4 w-full">
                <Link href="/checkout">{t('cart.checkout')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'numeric text-lg font-bold text-gold' : 'numeric'}>{value}</span>
    </div>
  )
}
