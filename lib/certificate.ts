import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { translate } from '@/lib/i18n'
import { renderPdf } from '@/lib/documents'
import type { Locale } from '@/lib/locale'

/**
 * The licence certificate.
 *
 * ── What this document is for ───────────────────────────────────────────────
 * It is the paper a buyer uploads when someone claims their footage. Of the
 * three ways a copyright problem arrives — an automated Content ID match, a
 * manual complaint, and a lawsuit — this answers the middle one, which is the
 * realistic case for stock footage. It names the licensee, the asset, the date
 * and the grant, and carries a number that can be checked against our records.
 *
 * The number already exists: `lib/orders.ts` mints a `LicenceCertificate` per
 * order item at purchase. This renders the document for a number already
 * issued, and never mints one.
 */

/**
 * Inlined so the PDF is self-contained and needs no server to resolve assets.
 *
 * The family names are the ones DESIGN.md declares — `Thmanyah Sans` and
 * `Thmanyah Serif Display` — not a shortened alias. A document that invents its
 * own family name is a second type system nobody maintains.
 */
async function fontFace(family: string, file: string, weight: number) {
  try {
    // Anchored to the project root. A relative path resolves against the
    // process working directory, which is not the repo under a standalone
    // build or a supervisor — and the catch below would swallow the miss and
    // silently render every certificate in a system fallback face.
    const data = await readFile(path.join(process.cwd(), 'public/fonts/thmanyah', file))
    return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');font-weight:${weight};font-display:block}`
  } catch {
    // A missing font is not a reason to fail a certificate. Chrome falls back
    // to a system Arabic face, which still shapes correctly — it is simply not
    // the brand.
    return ''
  }
}

export type CertificateData = {
  certificateNumber: string
  issuedAt: Date
  orderNumber: string
  licenseeName: string
  albumTitle: string
  creatorName: string
  clipCount: number
  licenceTitle: string
  licenceBody: string
}

/**
 * The document's markup.
 *
 * Exported so a gate can render and inspect it without launching a browser or
 * touching the database.
 */
export async function certificateHtml(data: CertificateData, locale: Locale) {
  // `tr`, not `t` — this renders outside any request, so the ambient store is
  // empty and every certificate would come out Arabic. Enforced by the gate.
  const tr = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
  const rtl = locale === 'ar'
  const fonts = (
    await Promise.all([
      fontFace('Thmanyah Sans', 'thmanyahsans-Regular.woff2', 400),
      fontFace('Thmanyah Sans', 'thmanyahsans-Bold.woff2', 700),
      fontFace('Thmanyah Serif Display', 'thmanyahserifdisplay-Black.woff2', 900),
    ])
  ).join('')

  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'long',
  }).format(data.issuedAt)

  const row = (label: string, value: string, numeric = false) => `
    <tr>
      <th>${label}</th>
      <td${numeric ? ' dir="ltr" class="numeric"' : ''}>${escapeHtml(value)}</td>
    </tr>`

  return `<!doctype html>
<html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><title>${escapeHtml(data.certificateNumber)}</title>
<style>
  ${fonts}
  :root { --gold:#7a6023; --ink:#15151a; --muted:#5d5d66; --line:#d9d5c9; }
  * { box-sizing:border-box; }
  body {
    font-family:'Thmanyah Sans', system-ui, sans-serif;
    color:var(--ink); margin:0; font-size:11pt; line-height:1.7;
  }
  /* Logical properties throughout, so the same markup sets both directions. */
  header { border-block-end:2px solid var(--gold); padding-block-end:14px; margin-block-end:26px; }
  .brand { font-family:'Thmanyah Serif Display', Georgia, serif;
           font-weight:900; font-size:22pt; color:var(--gold); letter-spacing:.02em; }
  .kind { color:var(--muted); font-size:10pt; margin-block-start:2px; }
  h1 { font-size:15pt; margin:0 0 4px; }
  .number { font-size:13pt; font-weight:700; color:var(--gold); }
  table { width:100%; border-collapse:collapse; margin-block:22px; }
  th, td { text-align:start; padding:9px 0; border-block-end:1px solid var(--line); vertical-align:top; }
  th { width:34%; font-weight:400; color:var(--muted); }
  td { font-weight:700; }
  /* A Latin run inside Arabic needs isolating or the punctuation migrates. */
  .numeric { direction:ltr; unicode-bidi:isolate; font-variant-numeric:tabular-nums; }
  .grant { background:#faf8f2; border:1px solid var(--line); border-radius:6px; padding:16px 18px; }
  .grant h2 { font-size:11pt; margin:0 0 8px; }
  .grant p { margin:0; white-space:pre-wrap; }
  footer { margin-block-start:28px; padding-block-start:12px; border-block-start:1px solid var(--line);
           color:var(--muted); font-size:8.5pt; }
</style></head>
<body>
  <header>
    <div class="brand">${tr('brand.name')}</div>
    <div class="kind">${tr('brand.tagline')}</div>
  </header>

  <h1>${tr('library.licencesTitle')}</h1>
  <div class="number numeric">${escapeHtml(data.certificateNumber)}</div>

  <table>
    ${row(tr('checkout.legalName'), data.licenseeName)}
    ${row(tr('commerce.album'), data.albumTitle)}
    ${row(tr('catalogue.creatorsTitle'), data.creatorName)}
    ${row(tr('catalogue.clipCountLabel'), String(data.clipCount), true)}
    ${row(tr('checkout.orderNumber'), data.orderNumber, true)}
    ${row(tr('library.purchasedOn'), date)}
    ${row(tr('commerce.licence'), data.licenceTitle)}
  </table>

  <div class="grant">
    <h2>${tr('catalogue.licenceDetails')}</h2>
    <p>${escapeHtml(data.licenceBody)}</p>
  </div>

  <footer>${tr('email.certificateFooter')}</footer>
</body></html>`
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

/**
 * Render and store the certificate for one order item, and record its key.
 *
 * Idempotent by key: regenerating overwrites the same file, so a retry after a
 * failed render does not produce a second document with a second number.
 *
 * Returns the storage key, or `null` when the certificate could not be built.
 * The caller must treat null as "send the message without it" — never as a
 * reason to withhold what the buyer paid for.
 */
/**
 * In-flight renders, keyed by order item.
 *
 * Without this, a buyer clicking the certificate link twice — or a browser
 * retrying the request — launches a second Chrome for the same document, and
 * the two race to write the same file and the same `pdfKey`. Sharing the
 * promise makes concurrent callers wait on one render instead of starting
 * another.
 *
 * Per-process, deliberately. A cross-process lock would need a table and a
 * lease, which is a great deal of machinery for a document generated once.
 */
const inFlight = new Map<string, Promise<string | null>>()

export function generateCertificate(orderItemId: string, locale: Locale) {
  const existing = inFlight.get(orderItemId)
  if (existing) return existing

  const render = renderCertificate(orderItemId, locale).finally(() => {
    inFlight.delete(orderItemId)
  })
  inFlight.set(orderItemId, render)
  return render
}

async function renderCertificate(orderItemId: string, locale: Locale) {
  const item = await db.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      clipManifestSnapshot: true,
      certificate: { select: { certificateNumber: true, issuedAt: true, pdfKey: true } },
      order: {
        select: {
          orderNumber: true,
          // The entity as it was AGREED, not as the user later edited their
          // profile — which is exactly why this snapshot is frozen.
          billingEntitySnapshot: true,
          user: { select: { name: true, email: true } },
        },
      },
      album: { select: { titleAr: true, titleEn: true } },
      creator: { select: { displayNameAr: true, displayNameEn: true } },
      licenceVersion: { select: { titleAr: true, titleEn: true, bodyAr: true, bodyEn: true } },
    },
  })

  if (!item?.certificate) return null

  const pick = (ar: string | null | undefined, en: string | null | undefined) =>
    (locale === 'ar' ? ar || en : en || ar) ?? ''

  const manifest = Array.isArray(item.clipManifestSnapshot) ? item.clipManifestSnapshot : []
  const billing = (item.order.billingEntitySnapshot ?? {}) as { legalName?: string | null }

  const html = await certificateHtml(
    {
      certificateNumber: item.certificate.certificateNumber,
      issuedAt: item.certificate.issuedAt,
      orderNumber: item.order.orderNumber,
      // The legal name on the order is what a licence names; the account name
      // is a fallback for an individual who gave none.
      licenseeName:
        billing.legalName || item.order.user?.name || item.order.user?.email || '—',
      albumTitle: pick(item.album.titleAr, item.album.titleEn),
      creatorName: pick(item.creator?.displayNameAr, item.creator?.displayNameEn),
      clipCount: manifest.length,
      licenceTitle: pick(item.licenceVersion?.titleAr, item.licenceVersion?.titleEn),
      licenceBody: pick(item.licenceVersion?.bodyAr, item.licenceVersion?.bodyEn),
    },
    locale,
  )

  const key = `certificates/${item.certificate.certificateNumber}.pdf`
  const stored = await renderPdf(html, key)
  if (stored) {
    await db.licenceCertificate.update({ where: { orderItemId }, data: { pdfKey: stored } })
  }
  return stored
}
