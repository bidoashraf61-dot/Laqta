/**
 * Interactive flow audit.
 *
 *   npm start &  →  npm run verify:flows
 *
 * The page audit proves a route RENDERS. This proves the controls on it
 * actually DO something — every dashboard verb goes through a server action,
 * and a server action that throws leaves the page looking perfectly fine.
 *
 * Each flow mutates real data and then asserts the mutation landed, so a
 * silently-swallowed action fails here rather than in front of an operator.
 */

import { chromium, type Browser, type Page } from 'playwright'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

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

/** Server-action errors surface in the console, never in the UI. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text())
  })
  return errors
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const adminContext = await signIn(browser, 'admin@laqta.sa')
  const creatorContext = await signIn(browser, 'creator@laqta.sa')

  console.log('Interactive flows\n')

  // ── Admin: toggle a promo code, and toggle it back ────────────────────────
  {
    const page = await adminContext.newPage()
    const errors = watchErrors(page)
    await page.goto(`${BASE}/admin/promos`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const firstToggle = page.locator('button').filter({ hasText: /^(مفعّل|متوقف)$/ }).first()
    const hasPromo = (await firstToggle.count()) > 0
    if (!hasPromo) {
      report('promo toggle (no promo codes seeded)', true, 'skipped')
    } else {
      const before = await firstToggle.textContent()
      await firstToggle.click()
      await page.waitForTimeout(1500)
      const after = await page
        .locator('button')
        .filter({ hasText: /^(مفعّل|متوقف)$/ })
        .first()
        .textContent()
      report('promo active toggles', before !== after, `${before?.trim()} → ${after?.trim()}`)
      // Put it back so the run is idempotent.
      await page.locator('button').filter({ hasText: /^(مفعّل|متوقف)$/ }).first().click()
      await page.waitForTimeout(1200)
    }
    report('no errors on the promos flow', errors.length === 0, errors.slice(0, 2).join(' | '))
    await page.close()
  }

  // ── Admin: the filter chips drive the URL and the list ───────────────────
  {
    const page = await adminContext.newPage()
    await page.goto(`${BASE}/admin/catalogue`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const chip = page.getByRole('link', { name: /منشور/ }).first()
    if ((await chip.count()) > 0) {
      await chip.click()
      await page.waitForTimeout(1500)
      report('filter chip writes to the URL', page.url().includes('status='), page.url().replace(BASE, ''))
      report(
        'filter chip marks itself current',
        (await page.locator('[aria-current="true"]').count()) > 0,
      )
    } else {
      report('filter chip present', false, 'no "منشور" chip found')
    }
    await page.close()
  }

  // ── Admin: analytics range picker re-queries ─────────────────────────────
  {
    const page = await adminContext.newPage()
    await page.goto(`${BASE}/admin/analytics`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
    const seven = page.getByRole('link', { name: /٧ أيام/ }).first()
    if ((await seven.count()) > 0) {
      await seven.click()
      await page.waitForTimeout(1600)
      report('range picker writes days=7', page.url().includes('days=7'), page.url().replace(BASE, ''))
      report(
        'range picker marks itself current',
        (await page.locator('[aria-current="true"]').count()) > 0,
      )
    } else {
      report('range picker present', false)
    }
    await page.close()
  }

  // ── Creator: search box filters the album manager ────────────────────────
  {
    const page = await creatorContext.newPage()
    const errors = watchErrors(page)
    await page.goto(`${BASE}/studio/albums`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const rowsBefore = await page.locator('tbody tr').count()
    await page.fill('input[type="search"]', 'zzzznotfound')
    await page.waitForTimeout(1600)
    const rowsAfter = await page.locator('tbody tr').count()
    report('search narrows the list', rowsAfter < rowsBefore || rowsAfter === 0, `${rowsBefore} → ${rowsAfter}`)
    report('search writes to the URL', page.url().includes('q='), page.url().replace(BASE, ''))
    report('no errors on the album manager', errors.length === 0, errors.slice(0, 2).join(' | '))
    await page.close()
  }

  // ── Creator: settings form round-trips through a server action ───────────
  {
    const page = await creatorContext.newPage()
    const errors = watchErrors(page)
    await page.goto(`${BASE}/studio/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)

    // The city split into an Arabic and an English column when the storefront
    // became bilingual; the Arabic one is the round-trip probe.
    const city = page.locator('#cityAr')
    const original = await city.inputValue()
    const probe = original === 'الرياض' ? 'جدة' : 'الرياض'
    await city.fill(probe)
    await page.locator('form', { has: page.locator('#cityAr') }).locator('button[type="submit"]').click()
    await page.waitForTimeout(2200)

    // Reload rather than trust the optimistic UI: the point is that it PERSISTED.
    await page.goto(`${BASE}/studio/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
    const saved = await page.locator('#cityAr').inputValue()
    report('profile form persists a change', saved === probe, `${original} → ${saved}`)

    // Restore.
    await page.locator('#cityAr').fill(original)
    await page.locator('form', { has: page.locator('#cityAr') }).locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)
    report('no errors on the settings flow', errors.length === 0, errors.slice(0, 2).join(' | '))
    await page.close()
  }

  // ── Creator: the mobile drawer opens ─────────────────────────────────────
  {
    const page = await creatorContext.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/studio`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
    const trigger = page.locator('button[aria-label="القائمة"]').first()
    if ((await trigger.count()) > 0) {
      await trigger.click()
      await page.waitForTimeout(900)
      const links = await page.locator('[role="dialog"] a').count()
      report('mobile nav drawer opens with links', links > 5, `${links} links`)
    } else {
      report('mobile nav trigger present', false)
    }
    await page.close()
  }

  // ── Creator: a rejected album shows why, on the album and in the list ───
  //
  // A fixture album is rejected with a note and a failed check, then removed.
  // The creator must see the reason, the failed check's name, and the
  // «لم يُقبل» badge — and must NOT see the reviewer's working note.
  {
    const db = new PrismaClient()
    const creator = await db.creator.findFirst({ where: { user: { email: 'creator@laqta.sa' } } })
    if (!creator) {
      report('rejected album explains itself', false, 'seed creator missing')
    } else {
      const slug = `verify-rejected-${Date.now()}`
      const album = await db.album.create({
        data: {
          slug,
          creatorId: creator.id,
          titleAr: 'ألبوم اختبار مرفوض',
          titleEn: 'Rejected test album',
          priceStandard: 100,
          status: 'delisted',
          delistedAt: new Date(),
          reviewTasks: {
            create: {
              status: 'rejected',
              decision: 'reject',
              decisionNote: 'سبب الرفض للاختبار: الإضاءة غير متناسقة.',
              decidedAt: new Date(),
              checklist: {
                quality: { state: 'fail', note: 'ملاحظة داخلية لا يراها صانع المحتوى' },
              },
            },
          },
        },
      })
      try {
        const page = await creatorContext.newPage()
        const errors = watchErrors(page)
        await page.goto(`${BASE}/studio/albums/${album.id}`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(900)
        const body = await page.locator('main').innerText()
        report(
          'rejected album shows the reason and the failed check',
          body.includes('لم يُقبل هذا الألبوم') &&
            body.includes('سبب الرفض للاختبار') &&
            body.includes('مستوى الجودة'),
        )
        report('reviewer working note stays private', !body.includes('ملاحظة داخلية'))

        await page.goto(`${BASE}/studio/albums?status=delisted`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(900)
        const row = page.locator('tr', { hasText: 'ألبوم اختبار مرفوض' })
        report('album list marks it «لم يُقبل»', (await row.getByText('لم يُقبل').count()) > 0)
        report('no errors on the rejected album', errors.length === 0, errors.slice(0, 2).join(' | '))
        await page.close()
      } finally {
        await db.album.delete({ where: { id: album.id } })
        await db.$disconnect()
      }
    }
  }

  // ── Admin: the sample curation page renders and its album picker works ──
  {
    const page = await adminContext.newPage()
    const errors = watchErrors(page)
    await page.goto(`${BASE}/admin/merchandising/sample`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
    report('sample curation page renders', (await page.getByText('العيّنة المجانية').count()) > 0)
    const chip = page.locator('a[href^="/admin/merchandising/sample?album="]').first()
    if ((await chip.count()) > 0) {
      await chip.click()
      await page.waitForTimeout(1500)
      const rows = await page.getByRole('button', { name: /^(أضف)$/ }).count()
      const added = await page.getByText('مضافة').count()
      report('album picker lists clips to add', rows + added > 0, `${rows} addable, ${added} added`)
    } else {
      report('album picker lists live albums', false, 'no album chip')
    }
    report('no errors on the sample curation page', errors.length === 0, errors.slice(0, 2).join(' | '))
    await page.close()
  }

  // Every route that carries filter chips, because the bug this replaced was
  // live on two pages while five others worked — testing one proves nothing.
  {
    const pages: Array<[string, 'admin' | 'creator']> = [
      ['/studio/albums', 'creator'],
      ['/admin/catalogue', 'admin'],
      ['/admin/creators', 'admin'],
      ['/admin/review', 'admin'],
      ['/admin/disputes', 'admin'],
      ['/admin/payouts', 'admin'],
      ['/admin/taxonomy', 'admin'],
    ]
    for (const [route, who] of pages) {
      const page = await (who === 'admin' ? adminContext : creatorContext).newPage()
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(900)
      // A chip is an anchor whose href is this route plus a query.
      const chip = page.locator(`a[href^="${route}?"]`).first()
      if ((await chip.count()) === 0) {
        report(`filters navigate on ${route}`, false, 'no filter chip rendered')
        await page.close()
        continue
      }
      const target = await chip.getAttribute('href')
      await chip.click()
      await page.waitForTimeout(1800)
      report(
        `filters navigate on ${route}`,
        page.url().endsWith(target ?? ''),
        page.url().replace(BASE, ''),
      )
      await page.close()
    }
  }

  await browser.close()
  console.log(failures ? `\n${failures} flow(s) failed.` : '\nEvery flow works.')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
