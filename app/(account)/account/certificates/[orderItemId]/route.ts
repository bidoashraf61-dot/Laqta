import { NextResponse, type NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documentPath } from '@/lib/storage'
import { generateCertificate } from '@/lib/certificate'
import { DEFAULT_LOCALE, isLocale } from '@/lib/locale'

/**
 * Serve a licence certificate.
 *
 * ── Why a route and not a public file ───────────────────────────────────────
 * A certificate names the buyer's legal entity and what they bought. Anything
 * under `public/` is served by filename to whoever guesses it, so these live
 * outside it and ownership is re-checked here — the same posture as
 * `/api/download`.
 *
 * Generated on demand when missing. A certificate whose render failed at
 * purchase, or one issued before this feature existed, is built on first
 * request rather than being permanently absent.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderItemId: string }> },
) {
  const { orderItemId } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const item = await db.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      certificate: { select: { certificateNumber: true, pdfKey: true } },
      order: { select: { userId: true, status: true, user: { select: { locale: true } } } },
    },
  })

  // One check, one answer. Never distinguish "not yours" from "does not
  // exist" — that difference is a way to enumerate other people's orders.
  if (!item || item.order.userId !== session.user.id || !item.certificate) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // An unpaid order has no licence to certify.
  if (item.order.status !== 'paid') {
    return NextResponse.json({ error: 'not_paid' }, { status: 403 })
  }

  const locale = isLocale(item.order.user?.locale) ? item.order.user.locale : DEFAULT_LOCALE
  const key = item.certificate.pdfKey ?? (await generateCertificate(orderItemId, locale))
  if (!key) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  try {
    const file = await readFile(documentPath(key))
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'content-type': 'application/pdf',
        // `inline` so it opens in the browser: this is a document to read and
        // hand on, not a payload to file away unseen.
        'content-disposition': `inline; filename="${item.certificate.certificateNumber}.pdf"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
