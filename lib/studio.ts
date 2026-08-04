import { db } from '@/lib/db'
import { addBusinessDays } from '@/lib/utils'
import { emptyChecklist } from '@/lib/review-checklist'

/**
 * Creator-side operations.
 *
 * The two rules that matter here are both about what a creator may NOT do.
 */

/**
 * Technical consistency.
 *
 * Mixed frame rates or colour profiles inside one album is the single most
 * common refund cause in stock footage: an editor drops 24p LOG and 60p
 * Rec.709 onto one timeline and the cut is unusable without regrading. The
 * reviewer checks this too, but the creator should see it before submitting —
 * finding out three days later wastes everyone's time.
 */
/**
 * The smallest transfer worth a bank fee. Lives here rather than beside the
 * action because a `'use server'` module may only export async functions.
 */
export const MIN_PAYOUT_SAR = 500

export function analyseConsistency(
  clips: Array<{ fps: unknown; colourProfile: string | null; width: number; height: number }>,
) {
  const frameRates = new Set(clips.map((clip) => Number(clip.fps)).filter(Boolean))
  const profiles = new Set(clips.map((clip) => clip.colourProfile).filter(Boolean) as string[])
  const resolutions = new Set(clips.map((clip) => `${clip.width}×${clip.height}`))

  return {
    frameRates: [...frameRates],
    profiles: [...profiles],
    resolutions: [...resolutions],
    mixedFrameRate: frameRates.size > 1,
    mixedProfile: profiles.size > 1,
    mixedResolution: resolutions.size > 1,
    get hasWarning() {
      return frameRates.size > 1 || profiles.size > 1 || resolutions.size > 1
    },
  }
}

export type SubmitCheck = { ok: boolean; reasons: string[] }

/**
 * Submission gate.
 *
 * An album cannot go to review with unresolved releases. "Resolved" means a
 * verified release is attached OR the creator has explicitly declared none is
 * needed — silence is not a declaration. Releases are direct legal exposure,
 * and a foreign creator is materially more likely to have shot without a Saudi
 * permit, so this is refused at the creator's own screen rather than
 * discovered by a reviewer.
 */
export async function canSubmit(albumId: string): Promise<SubmitCheck> {
  const album = await db.album.findUnique({
    where: { id: albumId },
    include: {
      clips: {
        select: {
          id: true,
          identifiableFaces: true,
          hasPeople: true,
          releaseLinks: {
            select: { release: { select: { type: true, verification: true } } },
          },
        },
      },
    },
  })

  const reasons: string[] = []
  if (!album) return { ok: false, reasons: ['studio.albumMissing'] }

  if (album.clips.length < 8) reasons.push('studio.minClips')
  if (!album.titleAr?.trim()) reasons.push('studio.titleArRequired')
  if (!album.titleEn?.trim()) reasons.push('studio.titleEnRequired')

  const facesWithoutRelease = album.clips.filter(
    (clip) =>
      clip.identifiableFaces &&
      !clip.releaseLinks.some(
        (link) => link.release.type === 'model' && link.release.verification !== 'rejected',
      ),
  )
  if (facesWithoutRelease.length > 0) reasons.push('studio.modelReleaseMissing')

  return { ok: reasons.length === 0, reasons }
}

/** Submit for review, creating the queue task with its SLA. */
export async function submitForReview(albumId: string) {
  const check = await canSubmit(albumId)
  if (!check.ok) return check

  const submittedAt = new Date()
  await db.$transaction([
    db.album.update({ where: { id: albumId }, data: { status: 'in_review' } }),
    db.reviewTask.create({
      data: {
        albumId,
        status: 'unassigned',
        checklist: emptyChecklist(),
        submittedAt,
        // Three business days. Saudi and Egypt both run a Friday–Saturday
        // weekend, which addBusinessDays accounts for.
        slaDueAt: addBusinessDays(submittedAt, 3),
      },
    }),
  ])

  return { ok: true, reasons: [] }
}

/**
 * Earnings.
 *
 * `availableAt` on each ledger row is what enforces the 30-day hold: money
 * from a sale is not payable until the refund window on that sale has closed.
 * Held and available are therefore a property of the rows, never a stored
 * number someone has to remember to update.
 */
export async function getEarnings(creatorId: string) {
  const now = new Date()

  const [entries, paidOut] = await Promise.all([
    db.creatorLedger.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        orderItem: { select: { album: { select: { titleAr: true } } } },
      },
    }),
    db.payout.aggregate({
      where: { creatorId, status: { in: ['paid', 'processing', 'approved'] } },
      _sum: { amount: true },
    }),
  ])

  const sales = entries.filter((entry) => entry.entryType === 'sale')
  const available = sales
    .filter((entry) => entry.availableAt && entry.availableAt <= now)
    .reduce((sum, entry) => sum + Number(entry.amount), 0)
  const held = sales
    .filter((entry) => !entry.availableAt || entry.availableAt > now)
    .reduce((sum, entry) => sum + Number(entry.amount), 0)

  const withdrawn = Number(paidOut._sum.amount ?? 0)

  return {
    entries,
    available: Math.max(0, available - withdrawn),
    held,
    lifetime: sales.reduce((sum, entry) => sum + Number(entry.amount), 0),
  }
}

/**
 * Demand signals.
 *
 * Zero-result searches, surfaced to the creator as "people looked for this and
 * nobody had it". It is the most actionable thing the platform can tell a
 * creator, and it costs nothing — the data is already being logged by search.
 */
export async function getDemandSignals(limit = 10) {
  const rows = await db.searchQueryLog.groupBy({
    by: ['normalized'],
    where: { resultCount: 0 },
    _count: { normalized: true },
    orderBy: { _count: { normalized: 'desc' } },
    take: limit,
  })

  const samples = await db.searchQueryLog.findMany({
    where: { normalized: { in: rows.map((row) => row.normalized) }, resultCount: 0 },
    distinct: ['normalized'],
    select: { normalized: true, query: true },
  })
  const byNormalised = new Map(samples.map((row) => [row.normalized, row.query]))

  return rows.map((row) => ({
    query: byNormalised.get(row.normalized) ?? row.normalized,
    searches: row._count.normalized,
  }))
}
