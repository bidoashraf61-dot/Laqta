import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { addToCart } from '../actions'
import { requestLocale } from '@/lib/locale-request'

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
  searchParams: Promise<{ album?: string }>
}) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const { album } = await searchParams
  if (!album) redirect('/albums')

  const session = await auth()
  if (!session?.user) {
    const back = `/cart/add?album=${encodeURIComponent(album)}`
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(back)}`)
  }

  const result = await addToCart(album)
  redirect(result.ok ? '/cart' : '/albums')
}
