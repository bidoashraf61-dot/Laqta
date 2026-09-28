import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exportAccountData } from '@/lib/account-privacy'

/**
 * «تنزيل بياناتك» (DEV-52): everything Laqta holds about the signed-in person,
 * as one JSON file. A route handler, not a page: the answer is a file.
 *
 * Only ever the session's own account — there is no id in the URL to change.
 * An admin viewing as a buyer gets nothing: that is the buyer's file, not theirs.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.impersonatedBy) {
    return new NextResponse(null, { status: 401 })
  }
  const data = await exportAccountData(session.user.id)
  if (!data) return new NextResponse(null, { status: 404 })

  const day = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? Number(value) : value), 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="laqta-my-data-${day}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
