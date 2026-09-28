'use client'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import ar from '@/messages/ar.json'
import en from '@/messages/en.json'
import '@/styles/globals.css'

/**
 * The last-resort screen: the ROOT layout itself failed, so there is no
 * LocaleProvider, no copy store and no shell above this. It renders its own
 * <html>, reads the language from the path, and takes the three strings
 * straight from the message files. Reports to Sentry (DEV-50) — a no-op until
 * a DSN is set.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [english, setEnglish] = useState(false)

  useEffect(() => {
    Sentry.captureException(error)
    console.error(error)
    setEnglish(/^\/en(\/|$)/.test(window.location.pathname))
  }, [error])

  const copy = english ? en.state : ar.state
  return (
    <html lang={english ? 'en' : 'ar'} dir={english ? 'ltr' : 'rtl'}>
      <body className="bg-background text-foreground">
        <main data-page="error" className="container flex min-h-dvh flex-col items-start justify-center gap-4 py-20">
          <h1 className="text-2xl font-bold">{copy.error}</h1>
          <p className="text-muted-foreground">{copy.errorHint}</p>
          <button type="button" onClick={reset} className="rounded-md border border-current px-4 py-2">
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  )
}
