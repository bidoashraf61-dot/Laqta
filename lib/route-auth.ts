import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * The session check for JSON route handlers under `/api/studio`.
 *
 * Those routes sit OUTSIDE the middleware matcher (a master part is a 16 MB+
 * request body, and Next buffers a middleware-visible body at 10 MB), so this
 * is the only guard in front of them — every handler calls it first, and then
 * scopes by `creatorId` itself.
 */
export async function studioActor() {
  const session = await auth()
  const user = session?.user
  if (!user) {
    return { actor: null, response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) }
  }
  if (user.role !== 'creator' && user.role !== 'admin') {
    return { actor: null, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { actor: user, response: null }
}

const STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  not_editable: 409,
  sold: 409,
  too_many: 409,
  verified: 409,
  size: 413,
  type: 415,
}

/** Refusal codes → HTTP status, one table for every studio upload route. */
export function refusal(code: string) {
  return NextResponse.json({ error: code }, { status: STATUS[code] ?? 400 })
}
