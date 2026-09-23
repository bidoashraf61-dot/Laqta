import { DIRECTION, HTML_LANG, type Locale } from '@/lib/locale'

/**
 * One message, two parts.
 *
 * A template describes a message as a short list of BLOCKS; this file turns
 * that one description into both the HTML part and the plain-text part, so the
 * two can never say different things. A template never writes markup.
 *
 * ── Mail clients are not browsers ───────────────────────────────────────────
 * - **Tables and inline styles.** Outlook renders with Word; Gmail strips
 *   `<style>` in some views. Everything that matters is inline.
 * - **Physical alignment, derived from direction.** The site uses logical
 *   properties only, but `text-align: start` is ignored by Outlook and older
 *   Gmail. `align` is therefore computed from the message's direction — never
 *   written as a literal — which keeps the RTL rule's intent: nothing is
 *   hard-coded to one side.
 * - **No web fonts.** Thmanyah cannot be loaded in mail. The stacks below
 *   reach the best Arabic face each platform ships: SF Arabic / Geeza on Apple,
 *   Segoe UI / Tahoma on Windows, Noto on Android and Gmail.
 * - **Light only.** The palette is paper and ink; a client's forced dark mode
 *   inverting it into grey-on-grey helps nobody, so the message declares it.
 *
 * ── The design rules that survive the medium ────────────────────────────────
 * - Paper ground, ink text, a white card — the site's own ladder.
 * - The ink band at the top is the letterbox: the film frame that is the
 *   product's own geometry, holding the wordmark.
 * - Gold appears ONCE, on the single primary action (One Voice Rule), with
 *   paper text on the deep gold. Nothing else is gold — not links, not rules.
 * - The two-cut headline: a light lead line over a bold statement.
 * - Every Latin run or number inside Arabic is isolated (`dir="ltr"` on an
 *   inline element is a bidi isolate), so an order number or an IBAN never
 *   reorders around the Arabic sentence it sits in.
 */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  /** Label → value rows. Values are isolated LTR: numbers, codes, IBANs. */
  | { kind: 'details'; rows: Array<{ label: string; value: string; ltr?: boolean }> }
  /** Someone else's words — an operator's note, a contact message. */
  | { kind: 'quote'; text: string }
  | { kind: 'button'; label: string; url: string }
  /** Small print under the action. */
  | { kind: 'note'; text: string }

export type Message = {
  subject: string
  /** Two-cut headline: the quiet lead line… */
  lead: string
  /** …and the statement. */
  heading: string
  blocks: Block[]
  /** Footer line — who this is from and why they received it. */
  footer: string
  brand: string
  tagline: string
  replyTo?: string
}

export type Rendered = { subject: string; text: string; html: string; replyTo?: string }

const PAPER = '#FAF8F3'
const INK = '#14141A'
const GOLD = '#7A6127'
const CARD = '#FFFFFF'
const MUTED = '#EFEBE2'
const MUTED_FG = '#666370'
const BORDER = '#CFC8BB'
const SAND = '#E9DCC3'

const SANS: Record<Locale, string> = {
  ar: "-apple-system, 'SF Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif",
  en: "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
}
const SERIF: Record<Locale, string> = {
  ar: "'Noto Naskh Arabic', 'Geeza Pro', 'Times New Roman', serif",
  en: "Georgia, 'Times New Roman', serif",
}

/** Every dynamic string passes through here. A contact message is untrusted. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Paragraph breaks from the copy survive; single newlines become <br>. */
const multiline = (value: string) => escapeHtml(value).replace(/\n/g, '<br>')

/** Only http(s) links are ever rendered as an href. */
const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : '#')

/** Plain-text bidi isolation: FSI … PDI around a Latin run inside Arabic. */
const isolateText = (value: string, locale: Locale) =>
  locale === 'ar' ? `\u2068${value}\u2069` : value

export function renderMessage(locale: Locale, message: Message): Rendered {
  return {
    subject: message.subject,
    text: renderText(locale, message),
    html: renderHtml(locale, message),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  }
}

function renderText(locale: Locale, message: Message) {
  const parts: string[] = [`${message.lead}\n${message.heading}`]

  for (const block of message.blocks) {
    switch (block.kind) {
      case 'p':
        parts.push(block.text)
        break
      case 'list':
        parts.push(block.items.map((item) => `• ${item}`).join('\n'))
        break
      case 'details':
        parts.push(
          block.rows
            .map((row) => `${row.label}: ${row.ltr === false ? row.value : isolateText(row.value, locale)}`)
            .join('\n'),
        )
        break
      case 'quote':
        parts.push(
          block.text
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n'),
        )
        break
      case 'button':
        parts.push(`${block.label}:\n${block.url}`)
        break
      case 'note':
        parts.push(block.text)
        break
    }
  }

  parts.push(`— ${message.brand}\n${message.tagline}\n\n${message.footer}`)
  return parts.filter((part) => part.trim()).join('\n\n')
}

function renderHtml(locale: Locale, message: Message) {
  const dir = DIRECTION[locale]
  const align = dir === 'rtl' ? 'right' : 'left'
  const sans = SANS[locale]
  const serif = SERIF[locale]
  const body = `font-family:${sans};font-size:16px;line-height:1.75;color:${INK};`

  const preheader = message.blocks.find((block) => block.kind === 'p') as
    | { kind: 'p'; text: string }
    | undefined

  const blocks = message.blocks
    .map((block) => {
      switch (block.kind) {
        case 'p':
          return `<p style="margin:0 0 16px;${body}text-align:${align};">${multiline(block.text)}</p>`

        case 'list':
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${block.items
            .map(
              (item) =>
                `<tr><td dir="${dir}" style="${body}text-align:${align};padding:10px 0;border-bottom:1px solid ${MUTED};font-weight:600;">${escapeHtml(item)}</td></tr>`,
            )
            .join('')}</table>`

        case 'details':
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:${PAPER};border:1px solid ${BORDER};border-radius:8px;">${block.rows
            .map((row, index) => {
              const value =
                row.ltr === false
                  ? escapeHtml(row.value)
                  : `<span dir="ltr" style="unicode-bidi:isolate;">${escapeHtml(row.value)}</span>`
              const rule = index < block.rows.length - 1 ? `border-bottom:1px solid ${MUTED};` : ''
              return `<tr><td dir="${dir}" style="font-family:${sans};font-size:14px;line-height:1.5;color:${MUTED_FG};text-align:${align};padding:12px 16px;${rule}width:34%;vertical-align:top;">${escapeHtml(row.label)}</td><td dir="${dir}" style="font-family:${sans};font-size:16px;line-height:1.5;color:${INK};text-align:${align};padding:12px 16px;${rule}font-weight:600;overflow-wrap:anywhere;word-break:break-word;">${value}</td></tr>`
            })
            .join('')}</table>`

        case 'quote':
          // A tonal step, not a coloured side bar: the note sits on muted.
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td dir="auto" style="${body}text-align:${align};background:${MUTED};border-radius:8px;padding:16px 20px;white-space:normal;">${multiline(block.text)}</td></tr></table>`

        case 'button':
          return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="margin:8px 0 24px;"><tr><td style="background:${GOLD};border-radius:8px;"><a href="${escapeHtml(safeUrl(block.url))}" style="display:inline-block;padding:14px 28px;font-family:${sans};font-size:16px;font-weight:700;line-height:1.2;color:${PAPER};text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a></td></tr></table><div style="clear:both;line-height:0;font-size:0;">&nbsp;</div>`

        case 'note':
          return `<p style="margin:0 0 12px;font-family:${sans};font-size:14px;line-height:1.7;color:${MUTED_FG};text-align:${align};">${multiline(block.text)}</p>`
      }
    })
    .join('\n')

  return `<!doctype html>
<html lang="${HTML_LANG[locale]}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(message.subject)}</title>
<style>
/* Phones: the card keeps a 16px gutter and its own inner padding narrows. Clients that drop <style> keep the desktop padding, which still fits. */
@media (max-width: 480px) {
  .lq-outer { padding: 16px !important; }
  .lq-band { padding: 18px 20px !important; }
  .lq-main { padding: 28px 20px 8px !important; }
  .lq-foot { padding: 16px 20px 24px !important; }
}
</style>
</head>
<body dir="${dir}" style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${escapeHtml(preheader?.text.split('\n')[0] ?? message.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td class="lq-outer" align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${CARD};border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
<tr><td class="lq-band" dir="${dir}" style="background:${INK};padding:22px 32px;text-align:${align};">
<span style="font-family:${serif};font-size:24px;font-weight:700;line-height:1.2;color:${PAPER};">${escapeHtml(message.brand)}</span>
<span style="font-family:${sans};font-size:14px;line-height:1.2;color:${SAND};padding-inline-start:12px;">${escapeHtml(message.tagline)}</span>
</td></tr>
<tr><td class="lq-main" dir="${dir}" style="padding:36px 32px 12px;text-align:${align};">
<p style="margin:0;font-family:${sans};font-size:22px;font-weight:300;line-height:1.35;color:${INK};text-align:${align};">${escapeHtml(message.lead)}</p>
<h1 style="margin:0 0 24px;font-family:${serif};font-size:28px;font-weight:700;line-height:1.3;color:${INK};text-align:${align};">${escapeHtml(message.heading)}</h1>
${blocks}
</td></tr>
<tr><td class="lq-foot" dir="${dir}" style="padding:20px 32px 28px;border-top:1px solid ${MUTED};text-align:${align};">
<p style="margin:0;font-family:${sans};font-size:14px;line-height:1.7;color:${MUTED_FG};text-align:${align};">${multiline(message.footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
