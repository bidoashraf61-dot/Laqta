'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { useT } from '@/lib/i18n-client'
import {
  CONSENT_OPEN_EVENT,
  clearAnalyticsCookies,
  gaMeasurementId,
  isAnalyticsPath,
  readConsent,
  rememberUtm,
  takeUtmCampaign,
  writeConsent,
  type Consent,
} from '@/lib/consent'

type Gtag = (...args: unknown[]) => void

/**
 * The analytics question, and Google Analytics behind it (DEV-46).
 *
 * A strip at the foot of the viewport, not a modal: the page stays usable
 * whether or not it is answered, and no answer means no analytics. Accept and
 * decline carry the SAME weight — neither is gold, neither is smaller — because
 * a consent nudged by design is not consent.
 *
 * Nothing from Google is requested until the answer is `granted`. Withdrawing
 * (the footer's «إعدادات التتبّع») deletes the Analytics cookies and reloads so
 * the loaded script is gone too.
 */
export function AnalyticsConsent() {
  const t = useT()
  const pathname = usePathname() ?? '/'
  const id = gaMeasurementId()
  const [consent, setConsent] = useState<Consent | null>(null)
  const [open, setOpen] = useState(false)
  const tracked = isAnalyticsPath(pathname)

  useEffect(() => {
    if (!id) return
    rememberUtm(window.location.search)
    const stored = readConsent()
    // A declined visitor keeps no Analytics cookie — including any Google
    // wrote in the moment between withdrawal and the reload.
    if (stored === 'denied') clearAnalyticsCookies()
    setConsent(stored)
    setOpen(stored === null)
    const reopen = () => setOpen(true)
    window.addEventListener(CONSENT_OPEN_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen)
  }, [id])

  useEffect(() => {
    if (!id || consent !== 'granted' || !tracked) return
    const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag }
    if (w.gtag) return
    w.dataLayer = w.dataLayer ?? []
    // gtag.js reads the `arguments` object itself, so this must stay a function.
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments)
    }
    w.gtag('js', new Date())
    // Page views on client navigations come from GA4's enhanced measurement
    // (browser history changes), so only the first one is sent here.
    w.gtag('config', id, { ...takeUtmCampaign() })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    document.head.appendChild(script)
  }, [id, consent, tracked])

  if (!id || !open || !tracked) return null

  const answer = (value: Consent) => {
    const withdrawn = consent === 'granted' && value === 'denied'
    writeConsent(value)
    setConsent(value)
    setOpen(false)
    if (withdrawn) {
      // Google's documented kill switch: stop the loaded script writing
      // cookies again before they are cleared.
      ;(window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = true
      clearAnalyticsCookies()
      window.location.reload()
    }
  }

  return (
    <section
      role="region"
      aria-labelledby="consent-title"
      data-consent="banner"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-lg border bg-card p-4 text-card-foreground shadow-lift sm:inset-x-6 sm:bottom-6 sm:p-5"
    >
      <h2 id="consent-title" className="text-sm font-bold">
        {t('consent.title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('consent.body')}{' '}
        <Link href="/privacy#cookies" className="underline underline-offset-4 hover:text-foreground">
          {t('consent.policy')}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="min-w-28" onClick={() => answer('granted')}>
          {t('consent.accept')}
        </Button>
        <Button type="button" variant="outline" size="sm" className="min-w-28" onClick={() => answer('denied')}>
          {t('consent.decline')}
        </Button>
      </div>
    </section>
  )
}

/** Footer control that reopens the question. Absent when there is no analytics. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  const t = useT()
  if (!gaMeasurementId()) return null
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      {t('consent.settings')}
    </button>
  )
}
