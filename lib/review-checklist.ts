/**
 * The canonical reviewer checklist.
 *
 * Stored on `ReviewTask.checklist` as JSON so checks can be added without a
 * migration — but always written through `emptyChecklist` / `setCheck` so the
 * shape stays stable and old tasks stay readable.
 *
 * Every album passes through these nine checks before it can go live. Three
 * are blocking: an album cannot be approved while `releases` or `cultural` is
 * failing, because both are direct legal exposure, or while `aiAccuracy` is —
 * a generated album that gets Saudi Arabia wrong breaks the product's promise.
 */

export const CHECK_KEYS = [
  'technical',
  'duplicate',
  'metadata',
  'releases',
  'coherence',
  'quality',
  'aiAccuracy',
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

/**
 * The words live in the dictionary (DEV-17: the operator reads Arabic):
 * `reviewCheck.<key>.label`, `.why` and `.p1`…`.pN` — the prompts the
 * reviewer must actually look at. `label` here is the English name kept for
 * logs and the gate's plain-text reason.
 */
export type CheckDefinition = {
  key: CheckKey
  label: string
  /** Approval is refused while a blocking check is failing. */
  blocking: boolean
  /** How many prompts `reviewCheck.<key>.p1…pN` holds. */
  prompts: number
}

export const CHECK_DEFINITIONS: CheckDefinition[] = [
  { key: 'technical', label: 'Technical consistency', blocking: false, prompts: 5 },
  { key: 'duplicate', label: 'Duplicate detection', blocking: false, prompts: 4 },
  { key: 'metadata', label: 'Metadata accuracy — both languages', blocking: false, prompts: 5 },
  { key: 'releases', label: 'Releases & permits complete', blocking: true, prompts: 6 },
  { key: 'coherence', label: 'Album coherence', blocking: false, prompts: 4 },
  { key: 'quality', label: 'Quality bar', blocking: false, prompts: 4 },
  // DEV-17. The reason a buyer picks Laqta over a global library is a Saudi
  // look that is RIGHT; a generated album with a warped minaret, garbled
  // Arabic on a shopfront or a thobe worn wrong fails that promise. Blocking,
  // like releases and cultural: a filmed album is marked «لا ينطبق».
  { key: 'aiAccuracy', label: 'AI accuracy', blocking: true, prompts: 5 },
  { key: 'cultural', label: 'Cultural & regulatory appropriateness', blocking: true, prompts: 5 },
  { key: 'thirdPartyIp', label: 'No third-party logos / IP', blocking: false, prompts: 4 },
]

export const CHECK_BY_KEY: Record<CheckKey, CheckDefinition> = Object.fromEntries(
  CHECK_DEFINITIONS.map((definition) => [definition.key, definition]),
) as Record<CheckKey, CheckDefinition>

export function emptyChecklist(): Checklist {
  return Object.fromEntries(
    CHECK_KEYS.map((key) => [key, { state: 'pending' as CheckState }]),
  ) as Checklist
}

const CHECK_STATES: readonly CheckState[] = ['pending', 'pass', 'fail', 'not_applicable']

/**
 * Tolerate old rows written before a check was added — and DISTRUST the input.
 *
 * This is the trust boundary for the checklist. It is fed straight from the
 * client in `submitReview`, and it is also the shape read back out of a JSON
 * column, so neither source is trustworthy. An unrecognised `state` used to be
 * cast through untouched, which was an approval bypass: `checklistProgress`
 * counts anything that is not `pending` as DECIDED, and only an exact `fail`
 * as a blocking failure. So a crafted `{ releases: { state: 'anything' } }`
 * read as "decided, not failing" and `canApprove` returned ok — publishing an
 * album whose model-release check had never actually passed.
 *
 * Unknown states now fall back to `pending`, which fails closed: the gate
 * refuses to approve until a reviewer decides the check for real.
 */
export function normaliseChecklist(value: unknown): Checklist {
  const base = emptyChecklist()
  if (!value || typeof value !== 'object') return base
  for (const key of CHECK_KEYS) {
    const entry = (value as Record<string, unknown>)[key]
    if (!entry || typeof entry !== 'object' || !('state' in entry)) continue

    const raw = entry as Record<string, unknown>
    const state = raw.state
    const text = (field: unknown) => (typeof field === 'string' ? field : undefined)

    base[key] = {
      state: CHECK_STATES.includes(state as CheckState) ? (state as CheckState) : 'pending',
      // Keep the audit trail — who decided a check and when — but only when it
      // is actually a string; the note is shown to the creator on a rejection.
      note: text(raw.note),
      checkedAt: text(raw.checkedAt),
      checkedBy: text(raw.checkedBy),
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
    return {
      ok: false as const,
      reason: 'Every check must be decided before approving.',
      reasonKey: 'admin.gateUndecided',
      failing: [] as CheckKey[],
    }
  }
  if (progress.blockingFailures.length > 0) {
    const labels = progress.blockingFailures.map((key) => CHECK_BY_KEY[key].label).join(', ')
    return {
      ok: false as const,
      reason: `Blocking check failing: ${labels}.`,
      reasonKey: 'admin.gateBlocking',
      failing: progress.blockingFailures,
    }
  }
  return { ok: true as const, reason: null, reasonKey: null, failing: [] as CheckKey[] }
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
