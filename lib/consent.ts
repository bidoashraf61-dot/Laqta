/**
 * Analytics consent (DEV-46; decision D10 — Google Analytics, loaded only after
 * the visitor agrees).
 *
 * The answer is kept in a first-party cookie the visitor's own browser holds —
 * strictly necessary, so it needs no consent itself. Nothing Google ever loads
 * until it reads `granted`. With `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset there is
 * no analytics, so there is nothing to ask and no banner at all.
 *
 * Browser-only helpers: every function touches `document`.
 */

export const CONSENT_COOKIE = 'laqta_consent'
/** Six months, then the question is asked again. */
const CONSENT_MAX_AGE = 60 * 60 * 24 * 182
/** Fired by the footer's «إعدادات التتبّع» to reopen the banner. */
export const CONSENT_OPEN_EVENT = 'laqta:consent-open'

export type Consent = 'granted' | 'denied'

export function gaMeasurementId(): string | null {
  const id = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim()
  return /^G-[A-Z0-9]+$/.test(id) ? id : null
}

export function readConsent(): Consent | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(granted|denied)`))
  return (match?.[1] as Consent | undefined) ?? null
}

export function writeConsent(value: Consent) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

/** Remove Google Analytics' own cookies after consent is withdrawn. */
export function clearAnalyticsCookies() {
  const names = document.cookie
    .split('; ')
    .map((pair) => pair.split('=')[0])
    .filter((name) => name === '_ga' || name.startsWith('_ga_') || name === '_gid')
  const host = location.hostname
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ''}`
    }
  }
}

/** Dashboards are the operator's and creators' tools, not the audience. */
export function isAnalyticsPath(pathname: string) {
  return !/^(\/en)?\/(admin|studio)(\/|$)/.test(pathname)
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'] as const
const UTM_STORE = 'laqta_utm'

/**
 * UTM tags from the landing URL, kept for this tab until Analytics may load.
 * A visitor who arrives from a campaign link, browses, and only then accepts
 * would otherwise be counted as "direct" — the tags were in the FIRST URL.
 */
export function rememberUtm(search: string) {
  try {
    const params = new URLSearchParams(search)
    const found = Object.fromEntries(UTM_KEYS.flatMap((key) => (params.get(key) ? [[key, params.get(key)!]] : [])))
    if (Object.keys(found).length > 0) sessionStorage.setItem(UTM_STORE, JSON.stringify(found))
  } catch {
    // Storage blocked: the tags are simply not carried over.
  }
}

/** The remembered tags as GA4 campaign parameters, once. */
export function takeUtmCampaign(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(UTM_STORE)
    sessionStorage.removeItem(UTM_STORE)
    if (!raw) return {}
    const utm = JSON.parse(raw) as Record<string, string>
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(utm)) out[key.replace('utm_', 'campaign_')] = value
    return out
  } catch {
    return {}
  }
}
