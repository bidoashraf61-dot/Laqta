/**
 * The canonical reviewer checklist.
 *
 * Stored on `ReviewTask.checklist` as JSON so checks can be added without a
 * migration — but always written through `emptyChecklist` / `setCheck` so the
 * shape stays stable and old tasks stay readable.
 *
 * Every album passes through these eight checks before it can go live. Two of
 * them are blocking: an album cannot be approved while `releases` or
 * `cultural` is failing, because both are direct legal exposure.
 */

export const CHECK_KEYS = [
  'technical',
  'duplicate',
  'metadata',
  'releases',
  'coherence',
  'quality',
  'cultural',
  'thirdPartyIp',
] as const

export type CheckKey = (typeof CHECK_KEYS)[number]
export type CheckState = 'pending' | 'pass' | 'fail' | 'not_applicable'

export type CheckEntry = {
  state: CheckState
  note?: string
  checkedAt?: string
  checkedBy?: string
}

export type Checklist = Record<CheckKey, CheckEntry>

export type CheckDefinition = {
  key: CheckKey
  label: string
  why: string
  /** Approval is refused while a blocking check is failing. */
  blocking: boolean
  /** Prompts the reviewer must actually look at, not prose. */
  prompts: string[]
}

export const CHECK_DEFINITIONS: CheckDefinition[] = [
  {
    key: 'technical',
    label: 'Technical consistency',
    why: 'Mixed 24p LOG + 60p Rec.709 in one album is a refund magnet.',
    blocking: false,
    prompts: [
      'Frame rates consistent across the album',
      'Colour profile consistent (all LOG or all Rec.709)',
      'Resolution floor met — no upscaled or soft clips',
      'No dropped frames, macro-blocking or rolling-shutter wobble',
      'Audio muted or intentional; no stray camera noise',
    ],
  },
  {
    key: 'duplicate',
    label: 'Duplicate detection',
    why: 'Stolen or re-listed footage.',
    blocking: false,
    prompts: [
      'Perceptual-hash matches reviewed',
      'No clip already live under another creator',
      'Not a re-upload of a previously rejected album',
      'Reverse-searched any suspiciously polished clip',
    ],
  },
  {
    key: 'metadata',
    label: 'Metadata accuracy — both languages',
    why: 'Search quality depends on it.',
    blocking: false,
    prompts: [
      'Arabic title and description present and idiomatic (not machine output)',
      'English title and description present',
      'Location tag matches what is actually on screen',
      'Category and tags accurate; no keyword stuffing',
      'Technical fields match the probe report',
    ],
  },
  {
    key: 'releases',
    label: 'Releases & permits complete',
    why: 'Direct legal exposure. Foreign creators are likelier to have shot without a Saudi permit.',
    blocking: true,
    prompts: [
      'Model release on file for every identifiable face',
      'Property release for private or branded premises',
      'Filming permit on file, with the issuing authority named',
      'Permit covers the shoot dates and the specific site',
      'Site-authority permit where required — RCU (AlUla), Diriyah Gate, NEOM, Red Sea Global, airports, military/government',
      'No footage of the two Holy Mosques without explicit written authorisation',
    ],
  },
  {
    key: 'coherence',
    label: 'Album coherence',
    why: 'One theme, not a dumping ground.',
    blocking: false,
    prompts: [
      'Single clear theme, location or subject',
      'Minimum 8 clips met',
      'No filler or near-identical repeats padding the count',
      'Cover clip represents the album',
    ],
  },
  {
    key: 'quality',
    label: 'Quality bar',
    why: "The catalogue's reputation.",
    blocking: false,
    prompts: [
      'Exposure, focus and stabilisation are broadcast-usable',
      'Composition is deliberate',
      'Clip lengths usable for editing (not 2-second fragments)',
      'Grade is neutral enough to be re-graded by the buyer',
    ],
  },
  {
    key: 'cultural',
    label: 'Cultural & regulatory appropriateness',
    why: 'Saudi decency and content standards (GCAM). Pre-vetted content is a core reason buyers choose us over global libraries.',
    blocking: true,
    prompts: [
      'Dress and conduct appropriate for the Saudi market',
      'No alcohol, gambling, or other prohibited subject matter',
      'Religious sites and practices handled respectfully and within policy',
      'No content that could read as political or security-sensitive',
      'Military, government and border facilities absent unless permitted',
    ],
  },
  {
    key: 'thirdPartyIp',
    label: 'No third-party logos / IP',
    why: 'Licensing risk.',
    blocking: false,
    prompts: [
      'No prominent brand logos or trade dress',
      'No copyrighted artwork, signage or architecture requiring clearance',
      'No recognisable third-party products as the subject',
      'Any incidental logo is small, unfocused and non-central',
    ],
  },
]

export const CHECK_BY_KEY: Record<CheckKey, CheckDefinition> = Object.fromEntries(
  CHECK_DEFINITIONS.map((definition) => [definition.key, definition]),
) as Record<CheckKey, CheckDefinition>

export function emptyChecklist(): Checklist {
  return Object.fromEntries(
    CHECK_KEYS.map((key) => [key, { state: 'pending' as CheckState }]),
  ) as Checklist
}

/** Tolerate old rows written before a check was added. */
export function normaliseChecklist(value: unknown): Checklist {
  const base = emptyChecklist()
  if (!value || typeof value !== 'object') return base
  for (const key of CHECK_KEYS) {
    const entry = (value as Record<string, unknown>)[key]
    if (entry && typeof entry === 'object' && 'state' in entry) {
      base[key] = entry as CheckEntry
    }
  }
  return base
}

export function checklistProgress(checklist: Checklist) {
  const entries = CHECK_KEYS.map((key) => checklist[key])
  const decided = entries.filter((entry) => entry.state !== 'pending').length
  const failed = CHECK_KEYS.filter((key) => checklist[key].state === 'fail')
  const blockingFailures = failed.filter((key) => CHECK_BY_KEY[key].blocking)
  return {
    total: CHECK_KEYS.length,
    decided,
    failed,
    blockingFailures,
    complete: decided === CHECK_KEYS.length,
  }
}

/**
 * Approval gate. A reviewer may only approve when every check has been
 * decided and no blocking check is failing.
 */
export function canApprove(checklist: Checklist) {
  const progress = checklistProgress(checklist)
  if (!progress.complete) {
    return { ok: false as const, reason: 'Every check must be decided before approving.' }
  }
  if (progress.blockingFailures.length > 0) {
    const labels = progress.blockingFailures.map((key) => CHECK_BY_KEY[key].label).join(', ')
    return { ok: false as const, reason: `Blocking check failing: ${labels}.` }
  }
  return { ok: true as const, reason: null }
}

/**
 * Releases and permits complete → the album earns the buyer-facing
 * "cleared for commercial use ✅" badge that agencies filter on.
 */
export function clearedForCommercial(checklist: Checklist) {
  return checklist.releases.state === 'pass' && checklist.thirdPartyIp.state !== 'fail'
}

/** Saudi sites that operate their own filming-permit authority. */
export const PERMIT_AUTHORITIES = [
  { value: 'rcu', label: 'Royal Commission for AlUla (RCU)', severity: 'high' },
  { value: 'diriyah_gate', label: 'Diriyah Gate Development Authority', severity: 'high' },
  { value: 'neom', label: 'NEOM', severity: 'high' },
  { value: 'red_sea_global', label: 'Red Sea Global', severity: 'high' },
  { value: 'holy_mosques', label: 'The Two Holy Mosques', severity: 'critical' },
  { value: 'gaca_airport', label: 'Airport authority (GACA)', severity: 'high' },
  { value: 'military', label: 'Military / government facility', severity: 'critical' },
  { value: 'gcam', label: 'General Commission for Audiovisual Media (GCAM)', severity: 'standard' },
  { value: 'municipality', label: 'Municipality / local permit', severity: 'standard' },
  { value: 'moc', label: 'Ministry of Culture', severity: 'standard' },
  { value: 'other', label: 'Other authority', severity: 'standard' },
] as const

export type PermitAuthority = (typeof PERMIT_AUTHORITIES)[number]['value']

export function permitAuthorityLabel(value: string | null | undefined) {
  if (!value) return null
  return PERMIT_AUTHORITIES.find((authority) => authority.value === value)?.label ?? value
}
