import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CHECK_KEYS,
  CHECK_BY_KEY,
  CHECK_DEFINITIONS,
  emptyChecklist,
  normaliseChecklist,
  checklistProgress,
  canApprove,
  clearedForCommercial,
  permitAuthorityLabel,
  type Checklist,
  type CheckKey,
} from '@/lib/review-checklist'

/**
 * The approval gate.
 *
 * This decides whether an album reaches the public catalogue. Two of its checks
 * are legal exposure — releases and cultural appropriateness — and the gate
 * exists so a reviewer in a hurry cannot wave them through. The tests pin the
 * refusals, not the happy path.
 */

/** Build a checklist with every key set, then override the interesting ones. */
function checklistWith(overrides: Partial<Record<CheckKey, Checklist[CheckKey]['state']>>) {
  const list = emptyChecklist()
  for (const key of CHECK_KEYS) {
    list[key] = { ...list[key], state: overrides[key] ?? 'pass' }
  }
  return list
}

describe('shape', () => {
  it('starts every check pending', () => {
    const list = emptyChecklist()
    for (const key of CHECK_KEYS) expect(list[key].state).toBe('pending')
  })

  it('defines every key exactly once', () => {
    expect(CHECK_DEFINITIONS).toHaveLength(CHECK_KEYS.length)
    expect(new Set(CHECK_DEFINITIONS.map((d) => d.key)).size).toBe(CHECK_KEYS.length)
  })

  it('marks releases and cultural as blocking — they are legal exposure', () => {
    const blocking = CHECK_DEFINITIONS.filter((d) => d.blocking).map((d) => d.key)
    expect(blocking).toContain('releases')
    expect(blocking).toContain('cultural')
  })
})

describe('normaliseChecklist', () => {
  it('turns null into a full pending checklist', () => {
    const list = normaliseChecklist(null)
    for (const key of CHECK_KEYS) expect(list[key].state).toBe('pending')
  })

  it('survives garbage without throwing', () => {
    for (const junk of [undefined, 0, 'nope', [], { technical: 'not-an-object' }]) {
      const list = normaliseChecklist(junk)
      expect(Object.keys(list).sort()).toEqual([...CHECK_KEYS].sort())
    }
  })

  it('backfills a key the stored JSON is missing', () => {
    const partial = { technical: { state: 'pass', note: null } }
    const list = normaliseChecklist(partial)
    expect(list.technical.state).toBe('pass')
    expect(list.releases.state).toBe('pending')
  })

  it('rejects an unknown state value rather than trusting it', () => {
    const list = normaliseChecklist({ technical: { state: 'definitely-fine', note: null } })
    expect(['pending', 'pass', 'fail', 'not_applicable']).toContain(list.technical.state)
  })
})

describe('canApprove — the refusals', () => {
  it('refuses while any check is undecided', () => {
    const list = checklistWith({ technical: 'pending' })
    const gate = canApprove(list)
    expect(gate.ok).toBe(false)
    expect(gate.reason).toMatch(/decided/i)
  })

  it('refuses when a BLOCKING check is failing', () => {
    const gate = canApprove(checklistWith({ releases: 'fail' }))
    expect(gate.ok).toBe(false)
    expect(gate.reason).toMatch(/blocking/i)
  })

  it('refuses on a failing cultural check', () => {
    expect(canApprove(checklistWith({ cultural: 'fail' })).ok).toBe(false)
  })

  it('ALLOWS a failing non-blocking check — a reviewer may accept the trade', () => {
    const gate = canApprove(checklistWith({ technical: 'fail' }))
    expect(gate.ok).toBe(true)
  })

  it('accepts not_applicable as decided', () => {
    expect(canApprove(checklistWith({ duplicate: 'not_applicable' })).ok).toBe(true)
  })

  it('approves only when everything is decided and no blocker fails', () => {
    expect(canApprove(checklistWith({})).ok).toBe(true)
  })
})

describe('checklistProgress', () => {
  it('reports incomplete until every check is decided', () => {
    expect(checklistProgress(checklistWith({ quality: 'pending' })).complete).toBe(false)
    expect(checklistProgress(checklistWith({})).complete).toBe(true)
  })

  it('names the blocking failures', () => {
    const progress = checklistProgress(checklistWith({ releases: 'fail', technical: 'fail' }))
    expect(progress.blockingFailures).toContain('releases')
    expect(progress.blockingFailures).not.toContain('technical')
  })
})

describe('clearedForCommercial', () => {
  it('requires releases to pass', () => {
    expect(clearedForCommercial(checklistWith({ releases: 'pass' }))).toBe(true)
    expect(clearedForCommercial(checklistWith({ releases: 'not_applicable' }))).toBe(false)
  })

  it('is withheld when third-party IP fails', () => {
    expect(clearedForCommercial(checklistWith({ thirdPartyIp: 'fail' }))).toBe(false)
  })
})

describe('permitAuthorityLabel', () => {
  it('resolves a known authority', () => {
    expect(typeof permitAuthorityLabel('rcu')).toBe('string')
  })

  it('degrades gracefully on null/unknown', () => {
    expect(() => permitAuthorityLabel(null)).not.toThrow()
    expect(() => permitAuthorityLabel('who-knows')).not.toThrow()
  })
})

describe('the AI-accuracy check (DEV-17)', () => {
  it('is a blocking check — a generated album that gets Saudi Arabia wrong cannot be approved', () => {
    expect(CHECK_BY_KEY.aiAccuracy.blocking).toBe(true)
    expect(canApprove(checklistWith({ aiAccuracy: 'fail' })).ok).toBe(false)
  })

  it('can be marked not applicable for a filmed album', () => {
    expect(canApprove(checklistWith({ aiAccuracy: 'not_applicable' })).ok).toBe(true)
  })

  it('names the failing check by key so the page can say it in Arabic', () => {
    const gate = canApprove(checklistWith({ aiAccuracy: 'fail' }))
    expect(gate.reasonKey).toBe('admin.gateBlocking')
    expect(gate.failing).toEqual(['aiAccuracy'])
  })
})

describe('the checklist copy (DEV-17)', () => {
  it('has an Arabic label, reason and every prompt for every check', () => {
    const ar = JSON.parse(readFileSync('messages/ar.json', 'utf8')) as { reviewCheck: Record<string, Record<string, string>> }
    for (const definition of CHECK_DEFINITIONS) {
      const copy = ar.reviewCheck[definition.key]
      expect(copy?.label, definition.key).toBeTruthy()
      expect(copy?.why, definition.key).toBeTruthy()
      for (let i = 1; i <= definition.prompts; i++) expect(copy[`p${i}`], `${definition.key}.p${i}`).toBeTruthy()
      expect(copy[`p${definition.prompts + 1}`], `${definition.key} has no extra prompt`).toBeUndefined()
    }
  })
})
