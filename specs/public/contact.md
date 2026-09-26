# Contact

**Route** `/contact` (Arabic) · `/en/contact` (English) · **Access** public, no account · **Rendering** server component, dynamic (reads the locale header; channel values read from env at request time); the form is a client component posting to a server action

## Purpose
Let anyone reach the operator: a contact form that always works, plus the direct lines (WhatsApp, support email) and the company's legal identity (name, Egyptian address, commercial registration number) once the owner supplies them.

## Data in
- `contactChannels()` from `content/contact.ts` — the ONE place the channel values live. Each field reads an env var first, then a committed constant; **all are empty until the owner supplies the real value, and nothing is invented.**

  | Field | Env var | Renders |
  | --- | --- | --- |
  | WhatsApp number | `NEXT_PUBLIC_CONTACT_WHATSAPP` (digits, international, no `+`) | "Prefer a direct line?" row → `https://wa.me/<digits>`, shown as `+<digits>` |
  | Support email | `NEXT_PUBLIC_CONTACT_EMAIL` | Same row → `mailto:` |
  | Company name | `CONTACT_COMPANY_NAME_AR` / `_EN` | Company details footer |
  | Registered address (Egypt) | `CONTACT_ADDRESS_AR` / `_EN` (`\n` for line breaks) | Company details footer, in `<address>` |
  | Commercial registration no. | `CONTACT_CR_NUMBER` | Company details footer, `.numeric` |

  The English name/address fall back to the Arabic (localisation contract).
- `CONTACT` from `content/legal.ts` — the four guidance sections (support, creators, rights reports, companies), rendered in the "Before you write" aside via `pickLocalised`. Still part of the export/import content pipeline and `verify:licence`'s copy scan.
- Copy: `messages/*.json` → `contact.*`.

## Layout
Page head is the site standard two-cut composition: `Headline` h1 (Sans Light lead «اكتب لنا،» / Serif Display Bold «ونرد عليك بأنفسنا.»; EN "Write to us," / "and a person replies.") over Serif Text `Prose`. The direct lines sit **in the head**, under the prose — on a phone WhatsApp is the fastest route and must be above the form. Below: the form card (paper → white card, `shadow-soft`) beside the guidance aside at `lg` (`minmax(0,1fr) | 20rem`), stacked on phone (form first). The company details footer closes the page above a hairline. Gold appears once: the submit button.

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| WhatsApp number (only if set) | Plain `<a target=_blank>` | Opens `wa.me/<digits>` — click-to-chat. sr-only "(opens in a new tab)" |
| Support email (only if set) | Plain `<a>` | `mailto:` |
| Name | Text, `autocomplete=name`, max 120 | Required, 2–120 chars |
| Email | `type=email`, `dir=ltr`, max 254 | Required, valid address; the hint says the reply goes here |
| Topic | Native `<select>`, optional | Blank, or one of `buying`, `selling`, `custom`, `rights`, `other` (labels `contact.topic.*`). `?topic=<one of these>` preselects it (`/sell`'s Apply sends `selling`); any other value leaves it blank |
| Message | Textarea, max 5000 | Required, 10–5000 chars; hint asks for the order number |
| "أرسل الرسالة" / "Send message" | Submit (gold, `lg`) | `sendContactMessage` server action in `app/(public)/actions.ts` |
| "اكتب رسالة أخرى" / "Write another message" | Button (success state) | Returns to an empty form |

Hidden honeypot field `website` (off-screen, `aria-hidden`, `tabIndex=-1`): if filled, the action returns success and stores nothing.

## States
- **Idle** — form, empty. With no channel values set the page is head + form + guidance, complete on its own; each value that is set adds its line (direct row appears when WhatsApp or email is set; company footer when any of name/address/CR is set).
- **Submitting** — button disabled with spinner and «جارٍ الإرسال…» / "Sending…"; form `aria-busy`.
- **Validation error** — zod errors come back as message keys per field, rendered under the field (`aria-invalid`, `aria-describedby`), a summary line beside the button (`role=alert`), and focus moves to the first invalid field. Everything typed is kept (`onSubmit` + controlled fields — not `<form action>`, which resets the form).
- **Rate limited** — «وصلتنا منك عدة رسائل…» in a `role=alert` box above the fields; values kept. Limits: 5 per salted-IP-hash per hour, 3 per email per 10 minutes, counted from stored rows.
- **Server error** — storage failure (or network drop) shows `contact.errServer` («…وما ضاع منها شيء. جرّب…»), never a validation message; values kept.
- **Success** — the form is replaced by a card: «وصلتنا رسالتك، شكراً لك.» + «نقرأ كل رسالة بأنفسنا، وردّنا يوصلك على بريدك:» and the address (`.ltr-island`). Focus moves to the heading. **No reply time is promised** — there is no SLA to back one (the old "within one business day" line was removed from `CONTACT` for the same reason).

## Invariants
- **Stored first, mailed second.** The `ContactMessage` row is written, then `notifyContactMessage` (`lib/notifications.ts`) mails `OPERATOR_EMAIL` via `sendMail`. A mail failure or a missing provider never fails the submission; `mailDelivered` records whether it left.
- **No invented contact details.** A channel renders only when its value is set in `content/contact.ts` / env.
- The action returns message **keys**, translated client-side with `useT()`, so the reply is in the page's language (`verify:action-locale`). `ContactMessage.locale` records the visitor's language.
- The raw IP is never stored — only a SHA-256 salted with `AUTH_SECRET`, used for the rate limit.
- No account required; no refund copy anywhere (owner decision 2026-09-23).
- Rights-takedown intake described here stays consistent with `/content-policy`; the form carries a `rights` topic but no attachments, so the guidance says "include" (اذكر), not "attach".
- Every Latin run is isolated: email field `dir=ltr`, number `.numeric dir=ltr`, email `.ltr-island`.

## Verified by
- `verify:arabic` — `/contact` and `/en/contact` both pass their purity checks.
- `verify:i18n`, `verify:action-locale`, `verify:licence` (copy scan includes `contact.*` and `CONTACT`).
- `audit` — route renders clean at desktop and phone.
- Manual (2026-09-24): empty submit → three inline errors + focus on name; filled submit on `/en/contact` → success card, row stored with `locale=en`, console logs "OPERATOR_EMAIL is not set — contact message stored, not mailed". Rendered at 1440 and phone width in both languages, with no channels and with all channels set (test values via env, not committed).
