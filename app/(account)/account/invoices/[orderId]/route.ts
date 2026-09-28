import { NextResponse, type NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documentPath } from '@/lib/storage'
import { generateInvoice } from '@/lib/invoice'
import { DEFAULT_LOCALE, isLocale } from '@/lib/locale'

/**
 * Serve an order's invoice (DEV-28). The same posture as the certificate
 * route beside it: outside `public/`, ownership re-checked, one answer for
 * "not yours" and "does not exist", generated on first request when missing.
 *
 * Refunded orders keep their invoice — it is the record of the sale the
 * refund reverses.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, invoice: { select: { invoiceNumber: true, pdfKey: true } }, user: { select: { locale: true } } },
  })
  if (!order || order.userId !== session.user.id || !order.invoice) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const locale = isLocale(order.user?.locale) ? order.user.locale : DEFAULT_LOCALE
  const key = order.invoice.pdfKey ?? (await generateInvoice(orderId, locale))
  if (!key) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  try {
    const file = await readFile(documentPath(key))
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${order.invoice.invoiceNumber}.pdf"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
