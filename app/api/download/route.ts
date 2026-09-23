import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { verifyDownload, resolveDownload } from '@/lib/storage'

/**
 * Download redemption.
 *
 * A valid signature is necessary but not sufficient. The entitlement is
 * re-checked here, at redemption, because a token issued five minutes ago must
 * stop working the instant an order is refunded or an entitlement revoked —
 * waiting for the TTL to lapse would hand out a free window on every refund.
 *
 * Every redemption is logged with IP, user agent and byte count. That log is
 * what makes abuse visible: one entitlement pulling 40GB from six addresses in
 * an hour is a shared password, and you cannot see it without this table.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const signature = request.nextUrl.searchParams.get('sig')
  if (!token || !signature) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  }

  const payload = verifyDownload(token, signature)
  if (!payload) {
    // Covers forged, tampered and expired alike — never say which.
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const entitlement = await db.entitlement.findUnique({
    where: { id: payload.entitlementId },
    include: { orderItem: { select: { order: { select: { status: true } } } } },
  })

  if (
    !entitlement ||
    entitlement.userId !== session.user.id ||
    entitlement.revokedAt !== null ||
    entitlement.orderItem.order.status !== 'paid'
  ) {
    return NextResponse.json({ error: 'no_entitlement' }, { status: 403 })
  }

  // The clip must be in the FROZEN snapshot, not merely in the album today.
  if (payload.clipId && !entitlement.clipIdsSnapshot.includes(payload.clipId)) {
    return NextResponse.json({ error: 'not_in_manifest' }, { status: 403 })
  }

  await db.download.create({
    data: {
      entitlementId: entitlement.id,
      userId: session.user.id,
      clipId: payload.clipId,
      isAlbumZip: payload.clipId === null,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    },
  })

  // The last hop: a short-lived CloudFront-signed or S3-presigned URL under the
  // s3 driver, `/media/<key>` under the local one. The gate above is identical
  // either way, and it has already run — signing never decides access.
  const target = await resolveDownload(payload.key)
  return NextResponse.redirect(new URL(target, request.nextUrl.origin))
}
