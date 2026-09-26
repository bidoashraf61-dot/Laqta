/**
 * The browser half of the studio's multipart upload (server half:
 * `lib/uploads.ts`, routes under `/api/studio/uploads`).
 *
 * start (or resume) → sign a batch of parts → PUT each part → complete.
 * The PUT target is whatever the server signed: a presigned S3 URL on the S3
 * driver (the bytes never touch the app), or the app's own `/part` route on
 * the local driver. This file does not know which, and must not.
 *
 * XHR rather than fetch for the PUTs: fetch still cannot report upload
 * progress, and a multi-GB master with no progress reads as a hung page.
 */

export type UploadProgress = { sent: number; total: number }

export class UploadError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

const PARALLEL_PARTS = 4
const SIGN_BATCH = 20
const RETRIES = 3

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let code = 'generic'
    try {
      code = ((await response.json()) as { error?: string }).error ?? code
    } catch {
      // Non-JSON error (a proxy's 502 page): generic.
    }
    throw new UploadError(code)
  }
  return (await response.json()) as T
}

function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // S3 exposes ETag only when the bucket's CORS lists it (docs/tech/media-aws.md).
        resolve(xhr.getResponseHeader('ETag') ?? '')
      } else {
        reject(new UploadError(xhr.status === 413 ? 'size' : 'generic'))
      }
    }
    xhr.onerror = () => reject(new UploadError('generic'))
    xhr.onabort = () => reject(new UploadError('aborted'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(blob)
  })
}

type Started = { clipId: string; partSize: number; partCount: number }
type Landed = { partNumber: number; size: number; etag: string }

/**
 * Upload one master. `resumeClipId` continues an interrupted upload: the
 * server lists what already landed and only the rest is sent.
 */
export async function uploadMaster(input: {
  file: File
  albumId: string
  resumeClipId?: string
  onStarted?: (clipId: string) => void
  onProgress: (progress: UploadProgress) => void
  signal: AbortSignal
}): Promise<string> {
  const { file, signal } = input

  let started: Started
  let landed: Landed[] = []
  if (input.resumeClipId) {
    const state = await json<{ parts: Landed[]; partSize?: number; partCount?: number }>(
      await fetch(`/api/studio/uploads/${input.resumeClipId}`, { cache: 'no-store' }),
    )
    if (!state.partSize || !state.partCount) throw new UploadError('generic')
    started = { clipId: input.resumeClipId, partSize: state.partSize, partCount: state.partCount }
    landed = state.parts
  } else {
    started = await json<Started>(
      await fetch('/api/studio/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ albumId: input.albumId, name: file.name, type: file.type, size: file.size }),
      }),
    )
  }
  input.onStarted?.(started.clipId)

  const { clipId, partSize, partCount } = started
  const etags = new Map<number, string>(landed.map((part) => [part.partNumber, part.etag]))
  const loaded = new Map<number, number>(landed.map((part) => [part.partNumber, part.size]))
  const report = () => {
    let sent = 0
    for (const value of loaded.values()) sent += value
    input.onProgress({ sent: Math.min(sent, file.size), total: file.size })
  }
  report()

  const todo = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !etags.has(n))
  const urls = new Map<number, string>()

  async function sign(from: number) {
    const batch = todo.slice(from, from + SIGN_BATCH)
    const { targets } = await json<{ targets: { partNumber: number; url: string }[] }>(
      await fetch(`/api/studio/uploads/${clipId}/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ partNumbers: batch }),
      }),
    )
    for (const target of targets) urls.set(target.partNumber, target.url)
  }

  let cursor = 0
  async function worker() {
    while (cursor < todo.length) {
      if (signal.aborted) throw new UploadError('aborted')
      const index = cursor++
      const n = todo[index]
      if (!urls.has(n)) await sign(index - (index % SIGN_BATCH))
      const blob = file.slice((n - 1) * partSize, n * partSize)
      for (let attempt = 1; ; attempt++) {
        try {
          const etag = await putPart(
            urls.get(n)!,
            blob,
            (bytes) => {
              loaded.set(n, bytes)
              report()
            },
            signal,
          )
          etags.set(n, etag)
          loaded.set(n, blob.size)
          report()
          break
        } catch (error) {
          loaded.set(n, 0)
          const code = (error as UploadError).code
          if (code === 'aborted' || code === 'size' || attempt >= RETRIES) throw error
          // A presigned URL may have expired during a long stall: re-sign.
          urls.delete(n)
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
          await sign(index - (index % SIGN_BATCH))
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, todo.length) }, worker))

  await json<{ ok: true }>(
    await fetch(`/api/studio/uploads/${clipId}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        parts: [...etags.entries()].map(([partNumber, etag]) => ({ partNumber, etag })),
      }),
    }),
  )
  return clipId
}

/** Cancel: abort the multipart upload and remove the clip row. */
export async function cancelUpload(clipId: string) {
  await fetch(`/api/studio/uploads/${clipId}`, { method: 'DELETE' }).catch(() => {})
}

/** Bytes → «1.4 GB». Latin digits, rendered inside a `.numeric` span. */
export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}
