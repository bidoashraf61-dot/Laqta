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
    // `data-page="error"` is what the journey gates look for — not «حدث خطأ».
    // They decide a page rendered by the ABSENCE of the error screen, so a
    // copy edit to its wording would have turned every broken page into a
    // silent pass. A marker cannot be reworded.
    <div data-page="error" className="container py-20">
      <ErrorState
        title={t('state.error')}
        description={t('state.errorHint')}
        retryLabel={t('state.retry')}
        onRetry={reset}
      />
    </div>
  )
}
