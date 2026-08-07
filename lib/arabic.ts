/**
 * Kashida — كشيدة, also called tatweel (تطويل).
 *
 * ── What this is, and why it is not letter-spacing ──────────────────────────
 * Arabic is cursive. `letter-spacing` pries apart glyphs that are drawn joined
 * and the word visibly breaks — which is why `.headline-airy` spaces WORDS and
 * never letters. Kashida is the correct device: it lengthens the CONNECTING
 * STROKE between two joined letters, so the word stays one continuous line and
 * simply becomes wider. Scribes have used it to justify a line of text since
 * long before there was a text engine to do it for them.
 *
 * It is a real character — U+0640 ARABIC TATWEEL — so no font hackery is
 * involved. The shaper draws the join longer because the join is longer.
 *
 * ── Where it may go ─────────────────────────────────────────────────────────
 * Only between two letters that actually join. Fourteen Arabic letters never
 * connect to the letter after them:
 *
 *     ا أ إ آ ٱ  د ذ  ر ز  و ؤ  ة ى  ء
 *
 * Put a tatweel after one of those and you get a stroke floating in the gap
 * with nothing attached to it — the exact broken look this device exists to
 * avoid. So every insertion is checked against that set first.
 *
 * ── Where it goes by choice ─────────────────────────────────────────────────
 * Before the FINAL letter of a word, which is where a scribe naturally draws
 * it out — the hand has arrived at the last form and lets it run. That single
 * rule reproduces the reference exactly: in "محتوى رايــح أبعــد", رايح and
 * أبعد are both elongated before their last letter, and محتوى is not, because
 * its penultimate letter is و and و joins nothing after it. The rule declines
 * on its own; it does not need a list of exceptions.
 */

const TATWEEL = 'ـ'

/** The fourteen that never join forward. */
const NO_FORWARD_JOIN = new Set('اأإآٱدذرزوؤةىء')

/**
 * Lam-alef. لا is a mandatory ligature, not two letters sitting next to each
 * other, and a tatweel dropped between them splits it into a lam and a
 * stranded alef — لــا. The join is real, so the joining test alone waves it
 * through; this is the one case that needs naming.
 */
const ALEFS = new Set('اأإآٱ')

/** Arabic letters, excluding the combining marks handled separately. */
const IS_LETTER = /[ء-غف-يٱ-ۓ]/
/** Harakat and other combining marks — they ride a letter, they are not one. */
const IS_MARK = /[ً-ٰٟۖ-ۭ]/

/**
 * Elongate the join before each word's final letter.
 *
 * `units` is how many tatweels to insert — each one is roughly one stroke
 * width, so 2 is a visible draw-out and 4 is a display flourish. Words with
 * fewer than three letters are left alone: there is no room to stretch a word
 * the eye reads as a single shape.
 *
 * Latin runs, numerals and punctuation pass through untouched.
 */
export function kashida(text: string, units = 2): string {
  if (!text || units < 1) return text

  // Split on whitespace but KEEP it, so the original spacing survives.
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (!token.trim()) return token

      const chars = [...token]

      // Index every base letter, ignoring the marks that sit on top of them.
      const letters: number[] = []
      for (let i = 0; i < chars.length; i++) {
        if (IS_LETTER.test(chars[i])) letters.push(i)
        else if (!IS_MARK.test(chars[i]) && /[A-Za-z0-9]/.test(chars[i])) return token
      }

      // Under three letters there is nothing to draw out.
      if (letters.length < 3) return token

      const finalAt = letters[letters.length - 1]
      const penultimate = chars[letters[letters.length - 2]]

      // The stroke has to have something to connect to on both sides.
      if (NO_FORWARD_JOIN.has(penultimate)) return token
      // …and لا must stay a ligature.
      if (penultimate === 'ل' && ALEFS.has(chars[finalAt])) return token

      // Insert before the final letter — and before any mark riding it, so the
      // haraka stays on its own letter rather than landing on the stroke.
      chars.splice(finalAt, 0, TATWEEL.repeat(units))
      return chars.join('')
    })
    .join('')
}

/** Strip every tatweel back out — for search keys, comparisons and tests. */
export function stripKashida(text: string): string {
  return text.replace(/ـ+/g, '')
}
