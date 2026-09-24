import { NextResponse, type NextRequest } from 'next/server'
import { auth, unstable_update } from '@/lib/auth'

/**
 * End a view-as-user session.
 *
 * A route handler rather than a server action, because it is the ONE write a
 * view may make and middleware refuses every other non-GET during a view; a
 * named path is something middleware can allow without allowing server
 * actions in general. The banner posts here with a plain `<form>`, so ending
 * works without JavaScript and cannot be swallowed by the client router.
 *
 * The token swap, the row's `endedAt` and the audit entry all happen in the
 * JWT callback (`lib/impersonation.ts#applyImpersonationEnd`), so there is one
 * code path whether the view ends here or by `update()` from a browser.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  const view = session?.user?.impersonation
  const targetId = session?.user?.id

  if (view) await unstable_update({ impersonation: { end: true } } as never)

  const back = view && targetId ? `/admin/users/${targetId}` : '/'
  return NextResponse.redirect(new URL(back, request.nextUrl.origin), 303)
}
