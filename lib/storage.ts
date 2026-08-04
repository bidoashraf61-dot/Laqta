import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Object storage and signed delivery.
 *
 * ── Status ──────────────────────────────────────────────────────────────────
 * No S3 credentials are configured, so the driver is `local`: keys resolve
 * against a directory on disk. The *signing* is real either way — the token
 * scheme below is what gates access to a master, and it does not change when
 * S3 arrives. Only `resolve()` does.
 *
 * ── Why masters are never a plain URL ───────────────────────────────────────
 * A master is the entire product. If a buyer can copy a link out of the
 * network tab and post it, the album is free forever. So:
 *
 *   · masters are never addressable — no public path, ever
 *   · every download goes through a short-lived HMAC token bound to the key,
 *     the entitlement and an expiry
 *   · the token is verified with `timingSafeEqual`, so it cannot be forged a
 *     byte at a time off the response time
 *   · the entitlement is re-checked at redemption, not just at issue — a
 *     refunded order must stop working immediately, not when the URL expires
 * ────────────────────────────────────────────────────────────────────────────
 */

const TTL_SECONDS = Number(process.env.S3_SIGNED_URL_TTL_SECONDS ?? 900)

function signingSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required to sign download URLs')
  return secret
}

export type SignedPayload = {
  key: string
  entitlementId: string
  clipId: string | null
  expiresAt: number
}

function payloadToString(payload: SignedPayload) {
  return [payload.key, payload.entitlementId, payload.clipId ?? '', payload.expiresAt].join('\n')
}

export function signDownload(payload: Omit<SignedPayload, 'expiresAt'>, ttlSeconds = TTL_SECONDS) {
  const full: SignedPayload = { ...payload, expiresAt: Date.now() + ttlSeconds * 1000 }
  const signature = createHmac('sha256', signingSecret())
    .update(payloadToString(full))
    .digest('base64url')

  const token = Buffer.from(JSON.stringify(full)).toString('base64url')
  return { token, signature, expiresAt: full.expiresAt }
}

export function verifyDownload(token: string, signature: string): SignedPayload | null {
  let payload: SignedPayload
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString())
  } catch {
    return null
  }

  const expected = createHmac('sha256', signingSecret())
    .update(payloadToString(payload))
    .digest('base64url')

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (Date.now() > payload.expiresAt) return null

  return payload
}

export function downloadUrl(payload: Omit<SignedPayload, 'expiresAt'>) {
  const { token, signature } = signDownload(payload)
  const params = new URLSearchParams({ token, sig: signature })
  return `/api/download?${params.toString()}`
}

/**
 * Turn a storage key into something fetchable.
 *
 * Local driver only for now. The S3 driver issues a presigned GET with the
 * same TTL; callers do not change.
 */
export function resolveKey(key: string) {
  if (key.startsWith('/')) return key
  const base = process.env.S3_ENDPOINT?.replace(/\/$/, '') ?? ''
  const bucket = process.env.S3_BUCKET_MASTERS ?? 'laqta-masters'
  return base ? `${base}/${bucket}/${key}` : `/media/${key}`
}

export const storageConfigured = Boolean(
  process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
)
