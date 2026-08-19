import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { addToCart } from '../actions'
import { LOCALE_HEADER } from '@/lib/locale'

/**
 * Add-to-cart. A route handler, not a page.
 *
 * ── Why this stopped being a page ───────────────────────────────────────────
 * It never rendered anything: it read a query parameter, performed a mutation
 * and redirected. As a page that made it a RENDER, and `addToCart` calls
 * `revalidatePath('/cart')` — which Next refuses during a render, because a
 * render may be retried or replayed and cache invalidation has to happen
 * exactly once.
 *
 * The result was that the buy button on every album page threw:
 *
 *     Route /cart/add used "revalidatePath /cart" during render
 *
 * and the buyer got «حدث خطأ» instead of a cart. Nothing was wrong with the
 * cart itself — the mutation was simply being performed somewhere it was not
 * allowed to be.
 *
 * A route handler is what this always was. Side effects and revalidation are
 * exactly what it is for.
 *
 * ── Why GET and not POST ────────────────────────────────────────────────────
 * The album page's buy button is a plain anchor, so it works before hydration
 * and survives a client-router navigation that declines to commit (see
 * CLAUDE.md). A GET that mutates is normally a mistake; here the mutation is
 * idempotent — `addToCart` upserts one cart line per album, so following the
 * link twice leaves the same single line.
 */
export async function GET(request: NextRequest) {
  const album = request.nextUrl.searchParams.get('album')

  /*
   * The locale rides on a request header the middleware set, because the `/en`
   * prefix has already been rewritten away by the time this runs. Every
   * redirect below has to put it back, or a buyer pressing Buy on the English
   * storefront lands in the Arabic cart.
   */
  const locale = request.headers.get(LOCALE_HEADER) === 'en' ? 'en' : 'ar'
  const to = (path: string) => new URL(locale === 'en' ? `/en${path}` : path, request.url)

  if (!album) return NextResponse.redirect(to('/albums'))

  const session = await auth()
  if (!session?.user) {
    // Bring them back to this exact add once signed in, prefix and all, so
    // nothing is lost to the detour.
    const back = `${locale === 'en' ? '/en' : ''}/cart/add?album=${encodeURIComponent(album)}`
    const signIn = to('/sign-in')
    signIn.searchParams.set('callbackUrl', back)
    return NextResponse.redirect(signIn)
  }

  const result = await addToCart(album)
  return NextResponse.redirect(to(result.ok ? '/cart' : '/albums'))
}
