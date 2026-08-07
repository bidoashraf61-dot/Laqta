import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * The Laqta icon set.
 *
 * ── Where the shapes come from ──────────────────────────────────────────────
 * Every icon here is built from a motif documented in a Saudi source. Nothing
 * is traced from another studio's artwork, and nothing is invented and then
 * given a cultural label after the fact. The five permitted forms:
 *
 *   الرُّكن    triangular openings and parapet cuts — At-Turaif's Najdi
 *              facades, al-Qatt al-Asiri, the Sadu weave
 *   البلسنة   the concentric diamond — Sadu weave, al-Qatt
 *   الأمشاط   "straight horizontal bands" on gypsum facades — Saudipedia's
 *              record of traditional Riyadh-province architecture
 *   الخروز    "circular carvings"; the cylindrical courtyard column — same
 *   القوس     the wooden arched window — same
 *
 * Three icons go further and draw a heritage OBJECT rather than applying a
 * motif to a generic one: `Basket` is a palm-frond سلة الخوص with its safayef
 * weave, `Chest` is the المندوس dowry chest with beams, iron nail heads and a
 * lock plate, and `Forever` is the band of interlocking diamonds carved into
 * Najdi doors — a figure with no end, which is what a permanent licence is.
 *
 * ── What this set is NOT for ────────────────────────────────────────────────
 * These carry brand. Functional affordances — close, chevrons, spinners, sort
 * arrows, panel toggles — stay on lucide. A custom mark adds nothing to an X
 * and costs the reader a beat working out whether it means something.
 *
 * The API matches lucide deliberately: 24-grid, `currentColor`, sized by
 * className (`size-4`), so these drop into existing call sites unchanged.
 */

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, className, ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

/** الخروز lens with a الركن aperture cut into it. */
export function Search(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.6" cy="10.6" r="7" />
      <path d="M15.7 15.7 20.8 20.8" />
      <path d="M10.6 7.4 13.2 12H8Z" />
    </Icon>
  )
}

/** A stack of frames; the contents are الأمشاط bands. */
export function Album(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.4 7.4h13V20h-13z" />
      <path d="M4 16.6V4h12.6" />
      <path d="M10.4 11.4h7M10.4 14.6h7M10.4 17.8h4.4" />
    </Icon>
  )
}

/** The letterbox frame banded top and bottom, with a الركن play mark. */
export function Clip(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.6 6.4h18.8v11.2H2.6z" />
      <path d="M2.6 9.4h18.8M2.6 14.6h18.8" />
      <path d="M10.6 10.6 14.6 12l-4 1.4Z" />
    </Icon>
  )
}

/** Pure الركن. The play triangle already was this shape. */
export function Play(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.4 4.4 19.6 12 7.4 19.6Z" />
    </Icon>
  )
}

/** A الركن arrowhead landing on الأمشاط. */
export function Download(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.2v6.6" />
      <path d="M7.4 9.8h9.2L12 15Z" />
      <path d="M4 18.4h16M4 21h16" />
    </Icon>
  )
}

/** The same, inverted. */
export function Upload(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20.8v-6.6" />
      <path d="M7.4 14.2h9.2L12 9Z" />
      <path d="M4 6h16M4 3.4h16" />
    </Icon>
  )
}

/** A document ruled with الأمشاط and sealed with a البلسنة. */
export function Licence(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3.4h9l5 5v12.2H5z" />
      <path d="M14 3.4v5h5" />
      <path d="M8.2 12.4h7.6M8.2 15.2h7.6" />
      <path d="M12 17.2 13.8 19 12 20.8 10.2 19Z" />
    </Icon>
  )
}

/** البلسنة carrying the clearance mark. */
export function Cleared(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.6 21.4 12 12 21.4 2.6 12Z" />
      <path d="m8.1 12 2.7 2.7 5.1-5.4" />
    </Icon>
  )
}

/**
 * المعيّنات المتشابكة — the interlocking diamond band carved into Najdi doors.
 * A figure with no end, for a licence that does not expire.
 */
export function Forever(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.2 12 5.5 8.7 8.8 12 5.5 15.3Z" />
      <path d="M8.8 12 12.1 8.7 15.4 12 12.1 15.3Z" />
      <path d="M15.4 12 18.7 8.7 22 12 18.7 15.3Z" />
    </Icon>
  )
}

/** An inverted الركن — the Najdi parapet cut, which is already a pin. */
export function Location(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21.4 4.4 8.4h15.2Z" />
      <path d="M12 11 14 13 12 15 10 13Z" />
    </Icon>
  )
}

/** الشبكة, the uniform grid of al-Qatt, with one cell turned to الركن. */
export function Category(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.6 3.6h6.8v6.8H3.6z" />
      <path d="M13.6 3.6h6.8v6.8h-6.8z" />
      <path d="M3.6 13.6h6.8v6.8H3.6z" />
      <path d="M17 13.4 20.6 20.4h-7.2Z" />
    </Icon>
  )
}

/**
 * A camera — and the one icon whose heritage is detailing rather than object,
 * because no heritage object means "content creator". It carries the Najdi
 * door's round-headed iron nails and a الخروز lens with a الركن aperture.
 */
export function Creator(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.8 7.6h4L8.4 5h7.2l1.6 2.6h4v12.2H2.8z" />
      <circle cx="12" cy="13.6" r="3.5" />
      <path d="M12 11.8 13.7 14.6h-3.4Z" />
      <circle cx="5.5" cy="10.3" r=".7" />
      <circle cx="18.5" cy="10.3" r=".7" />
    </Icon>
  )
}

/** البلسنة as the iris. */
export function Views(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.4 12C6 7.2 9 5.5 12 5.5s6 1.7 9.6 6.5c-3.6 4.8-6.6 6.5-9.6 6.5S6 16.8 2.4 12Z" />
      <path d="M12 9.4 14.6 12 12 14.6 9.4 12Z" />
    </Icon>
  )
}

/**
 * المندوس — the dowry chest: three beams, round-headed iron nail heads, and a
 * lock plate. Where value is kept, which is a truer figure for earnings than
 * a billfold.
 */
export function Chest(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.2 7.6h17.6v11.8H3.2z" />
      <path d="M5.4 7.6V5.4h13.2v2.2" />
      <path d="M3.2 11.4h17.6M3.2 15.4h17.6" />
      <path d="M10.4 11.4h3.2v4h-3.2z" />
      <circle cx="6.2" cy="9.5" r=".72" />
      <circle cx="12" cy="9.5" r=".72" />
      <circle cx="17.8" cy="9.5" r=".72" />
    </Icon>
  )
}

/**
 * سلة الخوص — the palm-frond basket. The bands are safayef, the broad woven
 * strips the craft is built from; palm-frond weaving is one of the five main
 * Saudi handicrafts.
 */
export function Basket(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.4 7.8h17.2l-1.9 11.8H5.3z" />
      <path d="M2.2 7.8h19.6" />
      <path d="M4.3 11.6h15.4M4.9 15.4h14.2" />
      <path d="M8.4 7.8 7.6 19.6M15.6 7.8l.8 11.8" />
    </Icon>
  )
}

/** A frame whose top edge is the Najdi triangular parapet. */
export function Resolution(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 20.4h18" />
      <path d="M3 20.4V9.6h18v10.8" />
      <path d="m3 9.6 2.6-4 2.6 4 2.6-4 2.6 4 2.6-4 2.6 4" />
    </Icon>
  )
}

/** A ruled sheet, checked. */
export function Review(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3.4h14v17.2H5z" />
      <path d="m8.4 9 1.8 1.8 3.6-3.8" />
      <path d="M8.4 14.4h7.2M8.4 17.4h4.6" />
    </Icon>
  )
}

/** الركن. The warning triangle already was this shape too. */
export function Dispute(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.4 21.6 20.4H2.4Z" />
      <path d="M12 10.2v4.6" />
      <path d="M12 17.6h.01" />
    </Icon>
  )
}

/** الأمشاط stood on end. */
export function Analytics(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.6 20.4V13" />
      <path d="M9.6 20.4V7.6" />
      <path d="M14.6 20.4v-5.6" />
      <path d="M19.4 20.4V4.2" />
    </Icon>
  )
}

/** الأمشاط with البلسنة handles riding them. */
export function Settings(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 7.6h17M3.5 16.4h17" />
      <path d="M9 5.6 11 7.6 9 9.6 7 7.6Z" />
      <path d="M15 14.4 17 16.4 15 18.4 13 16.4Z" />
    </Icon>
  )
}
