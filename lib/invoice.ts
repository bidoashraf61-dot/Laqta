import { db } from '@/lib/db'
import { formatMoneyIn, translate } from '@/lib/i18n'
import { renderPdf } from '@/lib/documents'
import { escapeHtml, fontFace, licensorLine } from '@/lib/certificate'
import { contactChannels } from '@/content/contact'
import type { Locale } from '@/lib/locale'

/**
 * The invoice document (DEV-28).
 *
 * Every paid order already had an `Invoice` row with a number (`settleOrder`),
 * and the site promised the buyer an invoice — but no document existed. This
 * renders one from what the order FROZE at purchase: the billing entity as it
 * was agreed, the line prices, the VAT rate and amount. Nothing is recomputed.
 *
 * It is titled «فاتورة» / "Invoice", deliberately not «فاتورة ضريبية»: a Saudi
 * tax invoice is a regulated document (ZATCA e-invoicing, a VAT registration
 * number, a QR code), and whether Laqta — an Egyptian company — issues one is
 * the accountant's open question (BIZ-03, decision D7). When that is answered,
 * this is the document that grows the missing fields.
 */

export type InvoiceData = {
  invoiceNumber: string
  orderNumber: string
  issuedAt: Date
  seller: { name: string; address: string; crNumber: string }
  buyer: { name: string; legalName: string | null; vatNumber: string | null; crNumber: string | null; address: string | null; poNumber: string | null }
  lines: Array<{ album: string; amount: number }>
  currency: string
  subtotal: number
  discount: number
  vatRate: number
  vat: number
  total: number
  refunded: number
}

export async function invoiceHtml(data: InvoiceData, locale: Locale) {
  const tr = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
  const rtl = locale === 'ar'
  const money = (value: number) => formatMoneyIn(locale === 'ar' ? 'ar-SA' : 'en-GB', value, data.currency)
  const fonts = (
    await Promise.all([
      fontFace('Thmanyah Sans', 'thmanyahsans-Regular.woff2', 400),
      fontFace('Thmanyah Sans', 'thmanyahsans-Bold.woff2', 700),
      fontFace('Thmanyah Serif Display', 'thmanyahserifdisplay-Black.woff2', 900),
    ])
  ).join('')
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'long' }).format(data.issuedAt)
  const num = (value: string) => `<span class="numeric">${escapeHtml(value)}</span>`
  const party = (title: string, lines: Array<string | null>) =>
    `<div class="party"><h2>${title}</h2>${lines.filter(Boolean).map((line) => `<p>${line}</p>`).join('')}</div>`
  const total = (label: string, value: string, strong = false) =>
    `<tr${strong ? ' class="grand"' : ''}><th>${label}</th><td>${num(value)}</td></tr>`

  return `<!doctype html>
<html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><title>${escapeHtml(data.invoiceNumber)}</title>
<style>
  ${fonts}
  :root { --gold:#7a6023; --ink:#15151a; --muted:#5d5d66; --line:#d9d5c9; }
  * { box-sizing:border-box; }
  body { font-family:'Thmanyah Sans', system-ui, sans-serif; color:var(--ink); margin:0; font-size:10.5pt; line-height:1.65; }
  header { display:flex; justify-content:space-between; align-items:flex-end; border-block-end:2px solid var(--gold); padding-block-end:14px; margin-block-end:22px; }
  .brand { font-family:'Thmanyah Serif Display', Georgia, serif; font-weight:900; font-size:22pt; color:var(--gold); }
  .kind { color:var(--muted); font-size:9.5pt; }
  h1 { font-size:15pt; margin:0; }
  .meta { color:var(--muted); font-size:9.5pt; text-align:end; }
  .meta strong { color:var(--ink); }
  .parties { display:flex; gap:24px; margin-block-end:22px; }
  .party { flex:1; border:1px solid var(--line); border-radius:6px; padding:12px 14px; }
  .party h2 { font-size:9.5pt; color:var(--muted); font-weight:400; margin:0 0 6px; }
  .party p { margin:0; }
  table { width:100%; border-collapse:collapse; }
  .lines th, .lines td { text-align:start; padding:9px 0; border-block-end:1px solid var(--line); }
  .lines thead th { color:var(--muted); font-weight:400; font-size:9.5pt; }
  .lines td:last-child, .lines th:last-child { text-align:end; }
  .totals { width:52%; margin-inline-start:auto; margin-block-start:14px; }
  .totals th { text-align:start; font-weight:400; color:var(--muted); padding:5px 0; }
  .totals td { text-align:end; padding:5px 0; }
  .totals .grand th, .totals .grand td { color:var(--ink); font-weight:700; font-size:12pt; border-block-start:2px solid var(--gold); padding-block-start:9px; }
  .numeric { display:inline-block; direction:ltr; unicode-bidi:isolate; font-variant-numeric:tabular-nums; }
  footer { margin-block-start:28px; padding-block-start:12px; border-block-start:1px solid var(--line); color:var(--muted); font-size:8.5pt; }
</style></head>
<body>
  <header>
    <div><div class="brand">${tr('brand.name')}</div><div class="kind">${tr('brand.tagline')}</div></div>
    <div class="meta">
      <h1>${tr('invoice.title')}</h1>
      <div>${tr('invoice.number')}: <strong>${num(data.invoiceNumber)}</strong></div>
      <div>${tr('invoice.order')}: ${num(data.orderNumber)}</div>
      <div>${tr('invoice.date')}: ${date}</div>
    </div>
  </header>

  <div class="parties">
    ${party(tr('invoice.seller'), [
      escapeHtml(data.seller.name),
      data.seller.address ? escapeHtml(data.seller.address).replace(/\n/g, '<br>') : null,
      data.seller.crNumber ? `${tr('invoice.cr')}: ${num(data.seller.crNumber)}` : null,
    ])}
    ${party(tr('invoice.buyer'), [
      escapeHtml(data.buyer.legalName || data.buyer.name),
      data.buyer.address ? escapeHtml(data.buyer.address) : null,
      data.buyer.vatNumber ? `${tr('invoice.vatNumber')}: ${num(data.buyer.vatNumber)}` : null,
      data.buyer.crNumber ? `${tr('invoice.cr')}: ${num(data.buyer.crNumber)}` : null,
      data.buyer.poNumber ? `${tr('invoice.po')}: ${num(data.buyer.poNumber)}` : null,
    ])}
  </div>

  <table class="lines">
    <thead><tr><th>${tr('invoice.item')}</th><th>${tr('invoice.amount')}</th></tr></thead>
    <tbody>
      ${data.lines.map((line) => `<tr><td>${escapeHtml(line.album)} · ${tr('invoice.licenceLine')}</td><td>${num(money(line.amount))}</td></tr>`).join('')}
    </tbody>
  </table>

  <table class="totals">
    ${total(tr('invoice.subtotal'), money(data.subtotal))}
    ${data.discount > 0 ? total(tr('invoice.discount'), `−${money(data.discount)}`) : ''}
    ${total(tr('invoice.vat', { rate: Math.round(data.vatRate * 100) }), money(data.vat))}
    ${total(tr('invoice.total'), money(data.total), true)}
    ${data.refunded > 0 ? total(tr('invoice.refunded'), `−${money(data.refunded)}`) : ''}
  </table>

  <footer>${tr('invoice.footer')}</footer>
</body></html>`
}

const inFlight = new Map<string, Promise<string | null>>()

/** Render and store the invoice for an order, and record its key. One render at a time per order. */
export function generateInvoice(orderId: string, locale: Locale) {
  const existing = inFlight.get(orderId)
  if (existing) return existing
  const render = renderInvoice(orderId, locale).finally(() => inFlight.delete(orderId))
  inFlight.set(orderId, render)
  return render
}

async function renderInvoice(orderId: string, locale: Locale) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      invoice: true,
      user: { select: { name: true, email: true } },
      items: { include: { album: { select: { titleAr: true, titleEn: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!order?.invoice) return null

  const pick = (ar: string | null | undefined, en: string | null | undefined) => (locale === 'ar' ? ar || en : en || ar) ?? ''
  const billing = (order.billingEntitySnapshot ?? {}) as {
    legalName?: string | null
    vatNumber?: string | null
    crNumber?: string | null
    billingAddress?: Record<string, string | null> | null
  }
  const address = billing.billingAddress
    ? ['line1', 'line2', 'city', 'region', 'postalCode', 'country'].map((key) => billing.billingAddress?.[key]).filter(Boolean).join('، ')
    : null
  const { company } = contactChannels()

  const html = await invoiceHtml(
    {
      invoiceNumber: order.invoice.invoiceNumber,
      orderNumber: order.orderNumber,
      issuedAt: order.invoice.issuedAt,
      seller: {
        name: licensorLine(locale).split(' · ')[0],
        address: locale === 'en' ? company.addressEn || company.addressAr : company.addressAr,
        crNumber: company.crNumber,
      },
      buyer: {
        name: order.user?.name || order.user?.email || '—',
        legalName: billing.legalName ?? null,
        vatNumber: billing.vatNumber ?? null,
        crNumber: billing.crNumber ?? null,
        address,
        poNumber: order.poNumber,
      },
      lines: order.items.map((item) => ({ album: pick(item.album.titleAr, item.album.titleEn), amount: Number(item.grossAmount) })),
      currency: order.currency,
      subtotal: Number(order.subtotal),
      discount: Number(order.discountAmount) + Number(order.bundleDiscountAmount),
      vatRate: Number(order.vatRate),
      vat: Number(order.vatAmount),
      total: Number(order.total),
      refunded: Number(order.refundedAmount),
    },
    locale,
  )

  const key = `invoices/${order.invoice.invoiceNumber}.pdf`
  const stored = await renderPdf(html, key)
  if (stored) await db.invoice.update({ where: { id: order.invoice.id }, data: { pdfKey: stored } })
  return stored
}
