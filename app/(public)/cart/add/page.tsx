import { redirect } from 'next/navigation'
import type { LicenceTier } from '@prisma/client'
import { auth } from '@/lib/auth'
import { addToCart } from '../actions'

/**
 * Add-to-cart landing.
 *
 * A GET route rather than a form post so the PDP's buy button is a plain link
 * — it has to work before hydration. Anonymous buyers are bounced to sign-in
 * with a callback that replays the add, so nothing is lost.
 */
export default async function AddToCartPage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string; tier?: string }>
}) {
  const { album, tier } = await searchParams
  if (!album) redirect('/albums')

  const session = await auth()
  if (!session?.user) {
    const back = `/cart/add?album=${encodeURIComponent(album)}&tier=${tier ?? 'standard'}`
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(back)}`)
  }

  const result = await addToCart(album, (tier as LicenceTier) ?? 'standard')
  redirect(result.ok ? '/cart' : '/albums')
}
