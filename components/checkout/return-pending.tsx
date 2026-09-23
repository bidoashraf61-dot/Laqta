'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/state'
import { Button } from '@/components/ui/button'
import { Link } from '@/components/ui/link'
import { useT } from '@/lib/i18n-client'

/** Every 3s for a minute: the signed callback normally lands within seconds. */
const INTERVAL_MS = 3_000
const ATTEMPTS = 20

/**
 * The pending half of /checkout/return.
 *
 * It re-renders the server page — which re-reads the ORDER — rather than
 * polling an endpoint of its own. The page is the one place that decides what
 * "paid" means; this only asks it again. After a minute it stops and says so,
 * and points at purchases rather than inviting a second payment.
 */
export function ReturnPending() {
  const t = useT()
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const slow = attempt >= ATTEMPTS

  useEffect(() => {
    if (slow) return
    const timer = window.setTimeout(() => {
      router.refresh()
      setAttempt((value) => value + 1)
    }, INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [attempt, slow, router])

  if (slow) {
    return (
      <>
        <p className="text-muted-foreground">{t('checkout.returnSlowBody')}</p>
        <Button asChild variant="outline">
          <Link href="/account/purchases">{t('checkout.viewPurchases')}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <Spinner className="mx-auto size-8" />
      <p className="text-muted-foreground">{t('checkout.returnPendingBody')}</p>
    </>
  )
}
