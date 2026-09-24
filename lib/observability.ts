/**
 * Error reporting — the privacy half, which does not depend on the SDK.
 *
 * Sentry (`@sentry/nextjs`) is the chosen error-monitoring processor; see
 * docs/sentry.md. Everything here is written so the SDK files are thin: they
 * pass `scrubEvent` as `beforeSend` and take their options from
 * `sentryOptions()`, and every rule about what may leave the site lives here,
 * where it is unit-tested (tests/unit/observability.test.ts).
 *
 * ── What is sent ────────────────────────────────────────────────────────────
 * Errors only: the exception, its stack, the route, the browser and the
 * release. No tracing unless `SENTRY_TRACES_SAMPLE_RATE` says otherwise, and no
 * session replay at all — no analytics or consent decision has been made, and
 * a replay is a recording of the visitor.
 *
 * ── What is never sent ──────────────────────────────────────────────────────
 * No email, no IP address, no cookies, no request body, no auth headers, no
 * query string (search terms and OTP links travel there). A buyer's identity is
 * not an error's business; the user is reduced to nothing.
 *
 * Isomorphic and dependency-free on purpose: the client, server and edge
 * configs all import it.
 */

/** The subset of a Sentry event this module touches. Structural, so the
 * scrubber can be tested without the SDK and accepts the SDK's `ErrorEvent`. */
export type ScrubbableEvent = {
  user?: Record<string, unknown> | null
  request?: {
    url?: string
    query_string?: unknown
    cookies?: unknown
    data?: unknown
    headers?: Record<string, string> | null
    env?: unknown
  } | null
  breadcrumbs?: Array<{ category?: string; message?: string; data?: Record<string, unknown> | null }>
  extra?: Record<string, unknown>
  message?: string
  exception?: { values?: Array<{ value?: string }> }
  [key: string]: unknown
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// IPv4, and IPv6 written with at least two colon groups.
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi
// Phone numbers: a + and 8–15 digits, optionally spaced — Saudi and Egyptian
// mobiles both sign in by phone.
const PHONE = /\+\d[\d\s-]{7,16}\d/g

/** Headers that are safe to keep. Everything else is dropped, not masked. */
const SAFE_HEADERS = new Set(['user-agent', 'accept-language', 'referer', 'content-type'])

export function scrubText(value: string): string {
  return value
    .replace(EMAIL, '[email]')
    .replace(IPV4, '[ip]')
    .replace(IPV6, '[ip]')
    .replace(PHONE, '[phone]')
}

/** Drop the query and fragment from a URL: search terms, tokens and OTP links. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

/**
 * Sentry `beforeSend`. Returns the same event, scrubbed in place. Never drops
 * an event — a scrubber that throws or returns null would silently turn
 * monitoring off.
 */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  // The user, entirely. Sentry fills `ip_address` from the connection when the
  // SDK sends `{{auto}}`; an empty object with no key stops that at ingest when
  // "Prevent storing of IP addresses" is on too (docs/sentry.md, step 3).
  if (event.user) event.user = {}

  if (event.request) {
    const req = event.request
    delete req.cookies
    delete req.data
    delete req.query_string
    delete req.env
    if (req.url) req.url = scrubText(stripQuery(req.url))
    if (req.headers) {
      const kept: Record<string, string> = {}
      for (const [name, value] of Object.entries(req.headers)) {
        const key = name.toLowerCase()
        if (!SAFE_HEADERS.has(key)) continue
        kept[name] = key === 'referer' ? stripQuery(value) : value
      }
      req.headers = kept
    }
  }

  if (typeof event.message === 'string') event.message = scrubText(event.message)

  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === 'string') value.value = scrubText(value.value)
  }

  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === 'string') crumb.message = scrubText(crumb.message)
      if (crumb.data) {
        for (const key of ['url', 'from', 'to']) {
          const v = crumb.data[key]
          if (typeof v === 'string') crumb.data[key] = scrubText(stripQuery(v))
        }
        // Request/response bodies a fetch integration might attach.
        delete crumb.data.body
        delete crumb.data.request_body
        delete crumb.data.response_body
      }
    }
  }

  if (event.extra) {
    for (const [key, v] of Object.entries(event.extra)) {
      if (typeof v === 'string') event.extra[key] = scrubText(v)
    }
  }

  return event
}

/** A sample rate from env, clamped to [0, 1]; 0 when unset or unparseable. */
export function sampleRate(raw: string | undefined): number {
  const n = Number(raw)
  if (!raw || !Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/**
 * The options every runtime shares. `enabled` is false with no DSN, so the SDK
 * is fully inert — no network, no global handlers doing work — until the owner
 * sets one.
 */
export function sentryOptions(dsn: string | undefined, tracesRaw: string | undefined) {
  const value = (dsn ?? '').trim()
  return {
    dsn: value || undefined,
    enabled: value.length > 0,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors only by default. Tracing is opt-in per deployment.
    tracesSampleRate: sampleRate(tracesRaw),
    // Never let the SDK attach IPs, cookies or user objects on its own.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    // Breadcrumbs also go out with an error: scrub them at creation too.
    beforeBreadcrumb<B extends { message?: string; data?: Record<string, unknown> | null }>(crumb: B): B {
      if (typeof crumb.message === 'string') crumb.message = scrubText(crumb.message)
      if (crumb.data && typeof crumb.data.url === 'string') {
        crumb.data.url = scrubText(stripQuery(crumb.data.url))
      }
      return crumb
    },
  }
}
