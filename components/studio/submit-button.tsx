'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/state'
import { toast } from '@/components/ui/toast'
import { submitAlbum } from '@/app/(studio)/studio/actions'
import { useT } from '@/lib/i18n-client'

/**
 * Submit for review.
 *
 * When the gate is closed the button is disabled AND the reasons are listed.
 * A disabled control with no explanation is the most common way a creator
 * portal generates support tickets.
 */
export function SubmitButton({
  albumId,
  canSubmit,
  reasons,
}: {
  albumId: string
  canSubmit: boolean
  reasons: string[]
}) {
  const t = useT()

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {!canSubmit && reasons.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>{t('studio.cannotSubmit')}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {reasons.map((reason) => (
                <li key={reason}>{t(reason)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        variant="default"
        disabled={!canSubmit || pending}
        onClick={() =>
          startTransition(async () => {
            const result = await submitAlbum(albumId)
            if (!result.ok) {
              setError(result.reasons.map((reason) => t(reason)).join(' · '))
              return
            }
            toast.success(t('studio.submitted'))
            router.refresh()
          })
        }
      >
        {pending ? t('state.loading') : t('studio.submit')}
      </Button>
    </div>
  )
}
