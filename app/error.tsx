'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/state'
import { useT } from '@/lib/i18n-client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useT()

  useEffect(() => {
    // Replace with the real reporter once observability is picked.
    console.error(error)
  }, [error])

  return (
    <div className="container py-20">
      <ErrorState
        title={t('state.error')}
        description={t('state.errorHint')}
        retryLabel={t('state.retry')}
        onRetry={reset}
      />
    </div>
  )
}
