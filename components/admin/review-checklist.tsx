'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import {
  CHECK_DEFINITIONS,
  canApprove,
  type CheckKey,
  type CheckState,
  type Checklist,
} from '@/lib/review-checklist'
import { cn } from '@/lib/utils'
import { submitReview } from '@/app/(admin)/admin/actions'
import { useT } from '@/lib/i18n-client'

const STATE_LABEL: Record<CheckState, string> = {
  pending: 'admin.checkPending',
  pass: 'admin.checkPass',
  fail: 'admin.checkFail',
  not_applicable: 'admin.checkNa',
}

/**
 * The reviewer checklist.
 *
 * Approval is gated in the UI *and* re-gated on the server. The client gate is
 * for the reviewer's benefit — an approve button that silently fails is worse
 * than one that explains itself — but it is not the authorisation boundary,
 * because a POST does not have to come from this component.
 *
 * `releases` and `cultural` are blocking. Both are direct legal exposure, and
 * both are exactly the checks a reviewer under SLA pressure would wave
 * through, which is why they are enforced rather than advised.
 */
export function ReviewChecklist({ taskId, initial }: { taskId: string; initial: Checklist }) {
  const t = useT()

  const router = useRouter()
  const [checklist, setChecklist] = useState<Checklist>(initial)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const gate = canApprove(checklist)

  const setCheck = (key: CheckKey, state: CheckState) =>
    setChecklist((current) => ({ ...current, [key]: { ...current[key], state } }))

  const decide = (decision: 'approve' | 'request_changes' | 'reject') =>
    startTransition(async () => {
      setError(null)
      const result = await submitReview({ taskId, checklist, decision, note })
      if (!result.ok) {
        setError(result.detail ?? t(result.messageKey))
        return
      }
      toast.success(t(result.messageKey))
      router.push('/admin')
      router.refresh()
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.checklist')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {CHECK_DEFINITIONS.map((definition) => {
          const current = checklist[definition.key].state
          return (
            <div key={definition.key} className="space-y-2 border-b pb-4 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{definition.label}</p>
                {definition.blocking ? (
                  <Badge variant="destructive">{t('admin.blocking')}</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{definition.why}</p>

              <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                {definition.prompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 pt-1">
                {(['pass', 'fail', 'not_applicable'] as CheckState[]).map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => setCheck(definition.key, state)}
                    aria-pressed={current === state}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      current === state
                        ? state === 'pass'
                          ? 'border-success bg-success/15 text-success'
                          : state === 'fail'
                            ? 'border-destructive bg-destructive/15 text-destructive'
                            : 'border-gold bg-gold/15 text-gold'
                        : 'border-input text-muted-foreground hover:border-foreground/25',
                    )}
                  >
                    {t(STATE_LABEL[state])}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <div className="space-y-2">
          <label htmlFor="note" className="text-sm font-medium">
            {t('admin.decisionNote')}
          </label>
          <Textarea
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('admin.decisionNote')}
          />
        </div>

        {!gate.ok ? (
          <Alert variant="warning">
            <AlertDescription>{gate.reason}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            disabled={!gate.ok || pending}
            onClick={() => decide('approve')}
          >
            {t('admin.approve')}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => decide('request_changes')}>
            {t('admin.requestChanges')}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => decide('reject')}>
            {t('admin.reject')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
