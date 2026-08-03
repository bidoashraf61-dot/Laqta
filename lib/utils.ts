import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Prisma Decimal, BigInt and Date are not serialisable across the RSC
 *  boundary. Normalise a query result before handing it to a client component. */
export function serialise<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return v.toString()
      if (v && typeof v === 'object' && 'toFixed' in v && typeof v.toFixed === 'function') {
        return Number(v)
      }
      return v
    }),
  )
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // strip Arabic diacritics
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** Human-readable byte size. Always rendered LTR — wrap in `.numeric`. */
export function formatBytes(bytes: number | bigint, fractionDigits = 1) {
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : fractionDigits)} ${units[i]}`
}

/** Seconds → `m:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (v: number) => v.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/**
 * Business days ahead of a date — the review SLA is 3 *business* days.
 * Saudi and Egypt both run a Friday–Saturday weekend.
 */
export function addBusinessDays(from: Date, days: number) {
  const date = new Date(from)
  let remaining = days
  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay() // 5 = Fri, 6 = Sat
    if (day !== 5 && day !== 6) remaining -= 1
  }
  return date
}
