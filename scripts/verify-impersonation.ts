/**
 * View-as-user gate.
 *
 *   npm start &  →  npm run verify:impersonation
 *
 * Support impersonation is the most dangerous control in the admin area: for
 * thirty minutes an admin's browser IS a customer. The owner's decision is
 * that it is read-only, audited and expiring, and every one of those three is
 * a server-side property a hidden button cannot prove. So this drives real
 * Chrome through a whole view and checks the database after every step:
 *
 *   - who may be viewed: buyers yes; admins, creators and yourself never
 *   - a non-admin cannot reach the control at all
 *   - start: reason required, row + `user.impersonate.start` audit written,
 *     the session is the customer's and the banner is on the page
 *   - read-only: a server-action POST, a writing GET and `/admin` are refused
 *     while the view is active, and nothing about the customer changed
 *   - end: the banner's button closes the row (`ended`), audits it, and hands
 *     the admin their own session back
 *   - expiry: a view whose clock has run out (the session cookie re-signed
 *     with a past `expiresAt`) is over on the next request, and the row is
 *     closed `expired` with its own audit entry
 */

import { chromium, type Browser, type BrowserContext } from 'playwright'
import { decode, encode } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import { viewRefusal } from '../lib/impersonation'
import { expireIfDue } from '../lib/impersonation-shared'

try {
  process.loadEnvFile('.env')
} catch {
  // Environment supplied by the caller.
}

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'
const SECRET = process.env.AUTH_SECRET ?? ''
const COOKIE = BASE.startsWith('https') ? '__Secure-authjs.session-token' : 'authjs.session-token'

const db = new PrismaClient()
let failures = 0
function report(label: string, ok: boolean, detail = '') {
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', 'Laqta!2026')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 20_000 }).catch(() => {})
  await page.close()
  return context
}

async function startView(context: BrowserContext, userId: string, reason: string) {
  const page = await context.newPage()
  await page.goto(`${BASE}/admin/users/${userId}`, { waitUntil: 'domcontentloaded' })
  await page.fill('textarea[name="reason"]', reason)
  await page.fill('input[name="ticketRef"]', 'VERIFY-1')
  await page.getByRole('button', { name: 'ابدأ العرض' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/account'), { timeout: 20_000 }).catch(() => {})
  return page
}

async function main() {
  if (!SECRET) throw new Error('AUTH_SECRET is not set — the expiry check re-signs the session cookie.')

  const admin = await db.user.findUniqueOrThrow({ where: { email: 'admin@laqta.sa' } })
  const buyer = await db.user.findUniqueOrThrow({
    where: { email: 'buyer@agency.sa' },
    include: { creator: { select: { id: true } } },
  })
  const creator = await db.user.findUniqueOrThrow({ where: { email: 'creator@laqta.sa' } })
  const buyerBefore = JSON.stringify(
    await db.user.findUnique({ where: { id: buyer.id }, select: { name: true, status: true, updatedAt: true } }),
  )

  console.log('View-as-user\n')

  // ── Who may be viewed ─────────────────────────────────────────────────────
  report('a buyer may be viewed', viewRefusal(admin.id, buyer) === null)
  report('an admin may not', viewRefusal(admin.id, { ...buyer, role: 'admin' }) === 'dash.viewAsRefusedAdmin')
  report('a creator may not', viewRefusal(admin.id, creator) === 'dash.viewAsRefusedCreator')
  report(
    'a 2FA-enrolled account may not',
    viewRefusal(admin.id, { ...buyer, twoFactorEnabled: true }) === 'dash.viewAsRefusedCreator',
  )
  report('yourself may not', viewRefusal(admin.id, admin) === 'dash.viewAsRefusedSelf')

  // ── The clock, on the token alone (what middleware runs) ─────────────────
  {
    const token = {
      uid: buyer.id,
      role: 'buyer',
      imp: {
        id: 'x',
        expiresAt: Date.now() - 1,
        targetName: 'x',
        admin: { uid: admin.id, role: 'admin', locale: 'ar', creatorId: null, name: null, email: admin.email, picture: null },
      },
    } as Record<string, unknown>
    expireIfDue(token)
    report('an expired token is the admin again', token.uid === admin.id && token.role === 'admin' && !token.imp)
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    // ── A non-admin cannot reach the control ───────────────────────────────
    {
      const context = await signIn(browser, 'buyer@agency.sa')
      const page = await context.newPage()
      await page.goto(`${BASE}/admin/users/${admin.id}`, { waitUntil: 'domcontentloaded' })
      report(
        'non-admin gets no view-as form',
        (await page.locator('textarea[name="reason"]').count()) === 0,
      )
      await context.close()
    }

    const adminContext = await signIn(browser, 'admin@laqta.sa')

    // ── Refusals render as words, not a form ───────────────────────────────
    {
      const page = await adminContext.newPage()
      await page.goto(`${BASE}/admin/users/${creator.id}`, { waitUntil: 'domcontentloaded' })
      report(
        'a creator shows the refusal, not the form',
        (await page.locator('textarea[name="reason"]').count()) === 0 &&
          (await page.getByText('حسابات صنّاع المحتوى لا تُعرض').count()) > 0,
      )
      await page.close()
    }

    // ── Reason is required ─────────────────────────────────────────────────
    {
      const before = await db.impersonation.count({ where: { targetUserId: buyer.id } })
      const page = await adminContext.newPage()
      await page.goto(`${BASE}/admin/users/${buyer.id}`, { waitUntil: 'domcontentloaded' })
      await page.locator('textarea[name="reason"]').evaluate((el) => el.removeAttribute('required'))
      await page.fill('textarea[name="reason"]', '   ')
      await page.getByRole('button', { name: 'ابدأ العرض' }).click()
      await page.waitForTimeout(1500)
      const after = await db.impersonation.count({ where: { targetUserId: buyer.id } })
      report('a blank reason opens nothing', after === before && page.url().includes('/admin/users/'))
      await page.close()
    }

    // ── Start ──────────────────────────────────────────────────────────────
    const started = new Date()
    const page = await startView(adminContext, buyer.id, 'verify:impersonation — library check')
    const row = await db.impersonation.findFirst({
      where: { targetUserId: buyer.id, adminId: admin.id, startedAt: { gte: started } },
      orderBy: { startedAt: 'desc' },
    })
    report('start lands in the customer account', new URL(page.url()).pathname.startsWith('/account'), page.url().replace(BASE, ''))
    report('start writes an open, expiring row', Boolean(row && !row.endedAt && row.expiresAt && row.expiresAt > new Date()))
    report(
      'start writes a user.impersonate.start audit row',
      (await db.auditLog.count({
        where: { action: 'user.impersonate.start', entityId: buyer.id, createdAt: { gte: started } },
      })) > 0,
    )
    report('the banner is on the page', (await page.locator('[data-impersonation-banner]').count()) === 1)
    const session = await page.evaluate(async () => (await fetch('/api/auth/session')).json())
    report('the session is the customer', session?.user?.id === buyer.id, String(session?.user?.id))
    report('the session names the admin', session?.user?.impersonatedBy === admin.id)

    // ── Read-only ──────────────────────────────────────────────────────────
    {
      const status = await page.evaluate(async () => {
        const response = await fetch('/account', {
          method: 'POST',
          headers: { 'Next-Action': 'verify-impersonation', 'Content-Type': 'text/plain;charset=UTF-8' },
          body: '[]',
        })
        return response.status
      })
      report('a server-action POST is refused', status === 403, String(status))

      const english = await page.evaluate(async () => (await fetch('/en/account/profile', { method: 'POST', body: '' })).status)
      report('an /en POST is refused too', english === 403, String(english))

      const writingGet = await page.evaluate(async () => (await fetch('/cart/add?album=x')).status)
      report('a writing GET is refused', writingGet === 403, String(writingGet))

      const download = await page.evaluate(async () => (await fetch('/api/download?clip=x')).status)
      report('a download is refused', download === 403, String(download))

      const adminPage = await adminContext.newPage()
      await adminPage.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded' })
      report(
        '/admin is out of reach during a view',
        // The role is the customer's, so middleware rewrites to /forbidden:
        // the user list never renders.
        (await adminPage.locator('[data-user-row]').count()) === 0,
      )
      await adminPage.close()

      const buyerAfter = JSON.stringify(
        await db.user.findUnique({ where: { id: buyer.id }, select: { name: true, status: true, updatedAt: true } }),
      )
      report('nothing about the customer changed', buyerAfter === buyerBefore)
    }

    // ── End ────────────────────────────────────────────────────────────────
    {
      await page.locator('[data-impersonation-banner] button[type="submit"]').click()
      await page.waitForURL((url) => url.pathname.startsWith('/admin/users/'), { timeout: 20_000 }).catch(() => {})
      const closed = row ? await db.impersonation.findUnique({ where: { id: row.id } }) : null
      report('end returns to the account page', page.url().includes(`/admin/users/${buyer.id}`), page.url().replace(BASE, ''))
      report('end closes the row as ended', Boolean(closed?.endedAt && closed.endReason === 'ended'))
      report(
        'end writes a user.impersonate.end audit row',
        (await db.auditLog.count({
          where: { action: 'user.impersonate.end', entityId: buyer.id, createdAt: { gte: started } },
        })) > 0,
      )
      report('the banner is gone', (await page.locator('[data-impersonation-banner]').count()) === 0)
      const back = await page.evaluate(async () => (await fetch('/api/auth/session')).json())
      report('the admin has their own session back', back?.user?.id === admin.id && back?.user?.role === 'admin')
      await page.close()
    }

    // ── Expiry ─────────────────────────────────────────────────────────────
    {
      const expiryStart = new Date()
      const view = await startView(adminContext, buyer.id, 'verify:impersonation — expiry')
      const open = await db.impersonation.findFirst({
        where: { targetUserId: buyer.id, startedAt: { gte: expiryStart } },
        orderBy: { startedAt: 'desc' },
      })
      const cookies = await adminContext.cookies(BASE)
      const cookie = cookies.find((c) => c.name === COOKIE)
      let rewrote = false
      if (cookie) {
        const token = await decode({ token: cookie.value, secret: SECRET, salt: COOKIE })
        const imp = token?.imp as { expiresAt: number } | undefined
        if (token && imp) {
          imp.expiresAt = Date.now() - 1000
          const value = await encode({ token, secret: SECRET, salt: COOKIE })
          await adminContext.addCookies([{ ...cookie, value }])
          rewrote = true
        }
      }
      report('the view cookie could be aged', rewrote)

      await view.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded' })
      await view.waitForTimeout(500)
      report('an expired view shows no banner', (await view.locator('[data-impersonation-banner]').count()) === 0)
      const after = await view.evaluate(async () => (await fetch('/api/auth/session')).json())
      report('an expired view is the admin again', after?.user?.id === admin.id && !after?.user?.impersonatedBy)

      await view.goto(`${BASE}/admin/users/${buyer.id}`, { waitUntil: 'domcontentloaded' })
      const closed = open ? await db.impersonation.findUnique({ where: { id: open.id } }) : null
      report('expiry closes the row as expired', Boolean(closed?.endedAt && closed.endReason === 'expired'))
      report(
        'expiry writes a user.impersonate.expired audit row',
        (await db.auditLog.count({
          where: { action: 'user.impersonate.expired', entityId: buyer.id, createdAt: { gte: expiryStart } },
        })) > 0,
      )
      await view.close()
    }

    await adminContext.close()
  } finally {
    await browser.close()
    await db.$disconnect()
  }

  console.log(failures === 0 ? '\nAll view-as-user checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exit(1)
})
