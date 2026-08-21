import { chromium, type Browser } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { documentPath } from '@/lib/storage'

/**
 * PDF generation.
 *
 * ── Why Chrome, and not a PDF library ───────────────────────────────────────
 * This product's documents are Arabic. `pdfkit`, `react-pdf` and their peers
 * do not shape Arabic: they need explicit bidi reordering and a font with the
 * right glyph substitution tables, and without both they emit Arabic as
 * disconnected letters in reverse order — a document that looks like a bug
 * report rather than a licence.
 *
 * Chrome already does bidi, already does glyph shaping, already lays out RTL,
 * and already renders the exact fonts the site uses. Playwright is already a
 * dependency because the browser gates drive it. So a document here is an
 * ordinary HTML page printed to PDF, and it looks like the site because it IS
 * the site's markup.
 *
 * The cost is a browser process per render. That is acceptable: documents are
 * generated once, on a purchase, not on every page view.
 *
 * ── One browser per render, not one held open ───────────────────────────────
 * Holding an instance saves ~300ms a render, and costs far more than it saves:
 * a live browser keeps handles on the event loop, so `process.exit` never
 * fires naturally and any short-lived process hangs forever after its work is
 * done. `verify:entitlement` settles an order, which renders a certificate,
 * and the gate simply never returned.
 *
 * A certificate is generated once per order item — not per request — so the
 * launch cost is paid on a path that already involves a payment. Correctness
 * of process lifetime beats 300ms on a background job.
 */

export async function renderPdf(html: string, key: string): Promise<string | null> {
  let browser: Browser | null = null
  try {
    // `channel: 'chrome'` uses the installed Chrome rather than a downloaded
    // build — the same choice the browser gates make, so a machine that can
    // run `npm run audit` can render a document.
    browser = await chromium.launch({ channel: 'chrome' })
    const page = await browser.newPage()

    // `domcontentloaded` and not `networkidle`: the document is self-contained
    // and waiting for an idle network on a page with no network is a two-second
    // tax per render.
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    // Fonts must be resolved before printing, or Arabic prints in a fallback
    // face — which shapes correctly but is not the brand.
    await page.evaluate(() => document.fonts.ready)

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    })

    const target = documentPath(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, pdf)
    return key
  } catch (error) {
    // Logged, not thrown. See the note on the return type.
    console.error(`[documents] failed to render ${key}:`, error)
    return null
  } finally {
    await browser?.close().catch(() => {})
  }
}
