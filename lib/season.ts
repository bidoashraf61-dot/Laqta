/**
 * Which occasion the storefront is currently selling for.
 *
 * ── The window LEADS the date, and that is the whole point ──────────────────
 * A stock buyer does not want Ramadan footage during Ramadan. They want it six
 * weeks earlier, while the campaign is being cut. A shelf that lights up on the
 * first day of Ramadan is a shelf that missed the sale — every one of these
 * windows opens well before the occasion and closes shortly after it starts,
 * because the moment the occasion arrives the work is already out.
 *
 * ── Why the Hijri dates are computed, not tabulated ─────────────────────────
 * Ramadan, Eid and Hajj move roughly eleven days earlier each Gregorian year, so
 * a hardcoded table is wrong within twelve months and silently wrong after
 * that — the shelf would simply promote the wrong season with total confidence.
 * `Intl` can format a date in `islamic-umalqura`, which is the calendar Saudi
 * Arabia actually runs on, so the month is read from the date rather than
 * guessed.
 *
 * Umm al-Qura is astronomical, and the Kingdom's official start of a month is
 * declared on a sighting that can differ by a day. That is fine here: these are
 * multi-week merchandising windows, not prayer times, and a day either way
 * changes nothing about which albums to show.
 */

export type Season = {
  /** Matches a `theme` taxonomy slug — see THEMES in prisma/seed.ts. */
  slug: string
  /** Inclusive month/day the shelf opens and closes, Gregorian. */
  gregorian?: { from: [number, number]; to: [number, number] }
  /** Inclusive Hijri month range, 1-indexed (9 = Ramadan, 12 = Dhu al-Hijjah). */
  hijri?: { from: number; to: number }
}

/**
 * Ordered by priority: the first match wins, so a narrow, high-intent occasion
 * beats a broad one it sits inside. Riyadh Season runs October to March and
 * would otherwise swallow Founding Day.
 */
const SEASONS: Season[] = [
  // Ramadan campaigns are cut through Sha'ban (8) and land in Ramadan (9).
  { slug: 'ramadan', hijri: { from: 8, to: 9 } },
  // Eid al-Fitr creative is made during Ramadan; Shawwal (10) is the tail.
  { slug: 'eid', hijri: { from: 10, to: 10 } },
  // Hajj coverage is commissioned through Dhu al-Qi'dah (11) into Dhu al-Hijjah.
  { slug: 'hajj-umrah', hijri: { from: 11, to: 12 } },
  // 23 September. The campaign window is the whole of August and September.
  { slug: 'national-day', gregorian: { from: [8, 1], to: [9, 30] } },
  // 22 February, worked on through January.
  { slug: 'founding-day', gregorian: { from: [1, 5], to: [2, 28] } },
  { slug: 'winter-tantora', gregorian: { from: [11, 1], to: [12, 31] } },
  { slug: 'riyadh-season', gregorian: { from: [10, 1], to: [3, 31] } },
]

/** The Hijri month number for a date, on the Umm al-Qura calendar. */
function hijriMonth(date: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      month: 'numeric',
      timeZone: 'Asia/Riyadh',
    }).formatToParts(date)
    const month = parts.find((part) => part.type === 'month')?.value
    const parsed = month ? Number(month) : NaN
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    // An environment without the Islamic calendar data should fall through to
    // the Gregorian seasons rather than throw and take the landing page down.
    return null
  }
}

function inGregorianWindow(date: Date, from: [number, number], to: [number, number]) {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const value = month * 100 + day
  const start = from[0] * 100 + from[1]
  const end = to[0] * 100 + to[1]
  // A window that wraps the new year (October → March) is two ranges.
  return start <= end ? value >= start && value <= end : value >= start || value <= end
}

/**
 * The occasion to merchandise right now, or `null` outside every window.
 *
 * `null` is a real answer, not a failure: there are stretches of the year with
 * no occasion worth leading with, and inventing one ("Summer collection!") for
 * a catalogue that has no summer albums is worse than showing the newest
 * offers instead.
 */
export function currentSeason(now: Date = new Date()): Season | null {
  const month = hijriMonth(now)

  for (const season of SEASONS) {
    if (season.hijri) {
      if (month != null && month >= season.hijri.from && month <= season.hijri.to) return season
      continue
    }
    if (season.gregorian && inGregorianWindow(now, season.gregorian.from, season.gregorian.to)) {
      return season
    }
  }
  return null
}
