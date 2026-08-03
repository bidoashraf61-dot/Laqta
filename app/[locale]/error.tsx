'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/state'
import { getTranslator, defaultLocale } from '@/lib/i18n'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Replace with the real reporter once observability is picked.
    console.error(error)
  }, [error])

  const t = getTranslator(defaultLocale)

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
