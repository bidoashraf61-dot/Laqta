import { isAbsolute, join } from 'node:path'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Object storage and signed delivery.
 *
 * ── Status ──────────────────────────────────────────────────────────────────
 * Two drivers behind one boundary (see "Drivers" below): `s3` when the AWS
 * environment is set, `local` otherwise. The *signing* is the same either way
 * — the token scheme below is what gates access to a master. Only the final
 * hop, `resolveDownload()`, differs.
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
 * ── Drivers ─────────────────────────────────────────────────────────────────
 * `s3`    — `S3_MASTERS_BUCKET` and `AWS_REGION` are set. Masters are private
 *           objects; a redemption is answered with a URL that expires in
 *           `S3_SIGNED_URL_TTL_SECONDS`:
 *             · a CloudFront signed URL when `MASTERS_CDN_URL`,
 *               `CLOUDFRONT_KEY_PAIR_ID` and `CLOUDFRONT_PRIVATE_KEY` are all
 *               set (edge-cached, cheaper egress on multi-GB files), else
 *             · an S3 presigned GET straight from the bucket.
 *           Credentials come from the AWS SDK default chain
 *           (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, or an instance role).
 * `local` — nothing configured. Keys resolve to `/media/<key>`, which nothing
 *           serves: a local redemption ends on a 404, honestly, rather than
 *           pretending a file was delivered.
 *
 * The PUBLIC media bucket (previews, posters, trailers, hero film) is a
 * different thing and never passes through here — see `lib/media.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type StorageDriver = 's3' | 'local'

function mastersBucket() {
  return process.env.S3_MASTERS_BUCKET?.trim() || ''
}

function awsRegion() {
  return process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || ''
}

export function storageDriver(): StorageDriver {
  return mastersBucket() && awsRegion() ? 's3' : 'local'
}

/** True when masters really live in S3. Shown on `/admin/settings`. */
export const storageConfigured = storageDriver() === 's3'

function cloudFrontSigning() {
  const base = process.env.MASTERS_CDN_URL?.trim().replace(/\/+$/, '')
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID?.trim()
  // An env file holds a multi-line PEM badly; accept literal `\n` escapes.
  const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  return base && keyPairId && privateKey ? { base, keyPairId, privateKey } : null
}

/** How masters are signed right now — for `/admin/settings` and the docs. */
export function downloadSigning(): 'cloudfront' | 's3-presigned' | 'local' {
  if (storageDriver() === 'local') return 'local'
  return cloudFrontSigning() ? 'cloudfront' : 's3-presigned'
}

/**
 * The local driver's answer, and what a "/"-rooted dev-seed key resolves to
 * under any driver. Synchronous and side-effect free.
 */
export function resolveKey(key: string) {
  if (key.startsWith('/')) return key
  return `/media/${key.replace(/^\/+/, '')}`
}

function encodeKey(key: string) {
  return key
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/**
 * Turn a PRIVATE storage key (master, editing proxy, album zip) into a URL the
 * browser can fetch for the next `S3_SIGNED_URL_TTL_SECONDS`.
 *
 * Call it only after the entitlement has been re-checked: it is the last hop
 * of `/api/download`, never a way to decide access.
 */
export async function resolveDownload(key: string): Promise<string> {
  // Dev-seed keys point at files under public/. They are stand-ins, not
  // masters, and stay local whatever the driver.
  if (key.startsWith('/') || storageDriver() === 'local') return resolveKey(key)

  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000)

  const signing = cloudFrontSigning()
  if (signing) {
    const { getSignedUrl } = await import('@aws-sdk/cloudfront-signer')
    return getSignedUrl({
      url: `${signing.base}/${encodeKey(key)}`,
      keyPairId: signing.keyPairId,
      privateKey: signing.privateKey,
      dateLessThan: expiresAt.toISOString(),
    })
  }

  const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ])
  const filename = key.split('/').pop() ?? 'laqta'
  return getSignedUrl(
    await s3Client(),
    new GetObjectCommand({
      Bucket: mastersBucket(),
      Key: key.replace(/^\/+/, ''),
      // Download, don't play: a master opened in a tab streams 4GB into memory.
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    { expiresIn: TTL_SECONDS },
  )
}

let client: import('@aws-sdk/client-s3').S3Client | null = null

/** One client per process. Also used by the media scripts. */
export async function s3Client() {
  if (client) return client
  const { S3Client } = await import('@aws-sdk/client-s3')
  const endpoint = process.env.S3_ENDPOINT?.trim()
  client = new S3Client({
    region: awsRegion() || 'us-east-1',
    // Only for an S3-compatible stand-in (MinIO, LocalStack) in development.
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  })
  return client
}

/**
 * Where generated documents live on disk.
 *
 * Deliberately NOT under `public/`. A licence certificate carries the buyer's
 * legal name and what they bought; anything in `public/` is served by filename
 * to anyone who guesses it. These are read back through an authenticated route
 * that re-checks ownership, the same posture as `/api/download`.
 *
 * When object storage is configured this becomes a bucket prefix and the route
 * becomes a redirect to a presigned GET. Callers do not change.
 */
export function documentPath(key: string) {
  // Absolute, anchored to the project root. A relative root resolves against
  // the process working directory, so a server started from elsewhere would
  // write documents somewhere the download route cannot find them — and every
  // certificate request would answer 503.
  const configured = process.env.DOCUMENT_ROOT ?? '.documents'
  const root = isAbsolute(configured) ? configured : join(process.cwd(), configured)
  // Keys are generated internally, never user-supplied — but a traversal here
  // would write outside the root, so the guard is cheap insurance.
  const safe = key.replace(/\.\./g, '').replace(/^\/+/, '')
  return join(root, safe)
}
