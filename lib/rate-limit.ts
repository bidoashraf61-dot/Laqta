import { createHash } from 'node:crypto'

/**
 * A small fixed-window rate limiter (DEV-48) for sign-in, sign-up and
 * checkout — the doors a script leans on.
 *
 * ── In memory, on purpose ───────────────────────────────────────────────────
 * Launch runs ONE server process (docs: DEV-14), so a per-process map is
 * exact and needs nothing else running. If the site is ever scaled to several
 * instances, each allows its own quota — the limits below are loose enough
 * that N× still stops a script, but move this to Postgres or Redis then.
 *
 * Keys are hashed before they are stored: an IP or an email in memory is
 * still personal data.
 */

type Window = { count: number; resetAt: number }
const windows = new Map<string, Window>()
let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key)
}

export function limitKey(...parts: Array<string | null | undefined>) {
  return createHash('sha256')
    .update(`${process.env.AUTH_SECRET ?? 'laqta'}:${parts.map((p) => p ?? '').join('|')}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Count one attempt against `bucket:key`. Returns whether it is allowed and,
 * when not, how many seconds until the window resets.
 */
export function hit(bucket: string, key: string, limit: number, windowMs: number, now = Date.now()) {
  sweep(now)
  const id = `${bucket}:${key}`
  const current = windows.get(id)
  if (!current || current.resetAt <= now) {
    windows.set(id, { count: 1, resetAt: now + windowMs })
    return { ok: true as const, retryAfterS: 0 }
  }
  current.count += 1
  if (current.count > limit) return { ok: false as const, retryAfterS: Math.ceil((current.resetAt - now) / 1000) }
  return { ok: true as const, retryAfterS: 0 }
}

/** Forget a key — e.g. a successful sign-in clears its failed-attempt count. */
export function clear(bucket: string, key: string) {
  windows.delete(`${bucket}:${key}`)
}

/** For tests only. */
export function resetAllLimits() {
  windows.clear()
}

/** The limits, in one place. */
export const LIMITS = {
  /** Password attempts per account: a person mistypes a few times; a script tries thousands. */
  signInPerEmail: { limit: 10, windowMs: 15 * 60_000 },
  /** Per network: offices share one IP, so looser than per account. */
  signInPerIp: { limit: 40, windowMs: 15 * 60_000 },
  signUpPerIp: { limit: 10, windowMs: 60 * 60_000 },
  checkoutPerUser: { limit: 20, windowMs: 10 * 60_000 },
  promoPerUser: { limit: 30, windowMs: 10 * 60_000 },
} as const

/** The client IP as the proxy reports it — first hop of X-Forwarded-For. */
export function clientIp(headers: Headers | null | undefined): string {
  return headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || headers?.get('x-real-ip') || 'unknown'
}

/**
 * Per-network limits skip loopback and an unknown address: that is the
 * server talking to itself (the verify gates), and behind a proxy that fails
 * to forward the client IP every visitor would share one bucket and lock each
 * other out. The per-account limits always apply.
 */
export function limitsNetwork(ip: string) {
  return !['unknown', '127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)
}
