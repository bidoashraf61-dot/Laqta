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
import bcrypt from 'bcryptjs'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { submitSignIn } from './two-factor-fixture.mjs'

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
  // Creator and admin answer the 2FA step too (scripts/two-factor-fixture.mjs).
  await submitSignIn(page, email, 'Laqta!2026')
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

  // ── Creator: upload a clip, watch it become ready, rename it; attach a scan
  //
  // Through the real page: the file input, the multipart upload, the ingest
  // job, the polling refresh, and the rename server action. Then a release
  // scan through its card, opened by an admin through the private route.
  {
    const db = new PrismaClient()
    const creator = await db.creator.findFirst({ where: { user: { email: 'creator@laqta.sa' } } })
    const dir = join(process.cwd(), '.media', 'verify-flows')
    mkdirSync(dir, { recursive: true })
    const master = join(dir, 'flow-master.mp4')
    const scan = join(dir, 'flow-permit.pdf')
    const made = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25', '-t', '2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', master,
    ])
    writeFileSync(scan, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
    if (!creator || made.status !== 0) {
      report('studio upload flow', false, !creator ? 'seed creator missing' : 'ffmpeg missing')
    } else {
      const album = await db.album.create({
        data: {
          slug: `verify-upload-${Date.now()}`,
          creatorId: creator.id,
          titleAr: 'ألبوم اختبار الرفع',
          titleEn: 'Upload test album',
          priceStandard: 100,
          status: 'draft',
        },
      })
      const release = await db.release.create({
        data: { creatorId: creator.id, type: 'permit', fileKey: `pending/${creator.id}`, subjectName: 'تصريح اختبار الرفع' },
      })
      try {
        const page = await creatorContext.newPage()
        const errors = watchErrors(page)
        // networkidle: the file input's onChange only exists once React has
        // hydrated, and a file set before that is silently ignored.
        await page.goto(`${BASE}/studio/albums/${album.id}`, { waitUntil: 'networkidle' })
        await page.locator('input[type="file"][multiple]').setInputFiles(master)
        const ready = await page
          .getByText('جاهزة', { exact: true })
          .first()
          .waitFor({ timeout: 90_000 })
          .then(() => true)
          .catch(() => false)
        // The page polls with router.refresh(), which on this codebase can
        // decline to commit under load (CLAUDE.md). One reload tells a
        // stale screen apart from a clip that really never became ready.
        const readyAfterReload =
          ready ||
          (await page
            .reload({ waitUntil: 'networkidle' })
            .then(() => page.getByText('جاهزة', { exact: true }).first().waitFor({ timeout: 30_000 }))
            .then(() => true)
            .catch(() => false))
        report('an uploaded clip reaches «جاهزة» on the page', readyAfterReload, ready ? '' : 'after one reload')
        const clip = await db.clip.findFirst({ where: { albumId: album.id } })
        report('its specs came from the file', clip?.width === 1280 && Number(clip?.fps) === 25, `${clip?.width}×${clip?.height}@${clip?.fps}`)

        await page.getByRole('button', { name: 'المزيد' }).first().click()
        await page.getByRole('menuitem', { name: 'تعديل العنوان' }).click()
        await page.fill('input[name="titleAr"]', 'كثبان عند الغروب')
        await page.getByRole('button', { name: 'حفظ', exact: true }).click()
        await page.getByText('كثبان عند الغروب').first().waitFor({ timeout: 10_000 }).catch(() => {})
        const renamed = await db.clip.findFirst({ where: { albumId: album.id }, select: { titleAr: true } })
        report('renaming a clip lands', renamed?.titleAr === 'كثبان عند الغروب')

        // DEV-10: who is in the shot, from the clip menu.
        await page.getByRole('button', { name: 'المزيد' }).first().click()
        await page.getByRole('menuitemcheckbox', { name: 'وجوه واضحة' }).click()
        await page.getByText('تحتاج تصريح نموذج', { exact: false }).first().waitFor({ timeout: 10_000 }).catch(() => {})
        const flagged = await db.clip.findFirst({ where: { albumId: album.id }, select: { hasPeople: true, identifiableFaces: true } })
        report('marking clear faces sets faces AND people', flagged?.identifiableFaces === true && flagged?.hasPeople === true)

        // DEV-12: every title in one form.
        await page.getByRole('button', { name: 'تعديل كل العناوين' }).click()
        const en = page.locator('form[data-bulk-titles] input[dir="ltr"]').first()
        await en.fill('Dunes at sunset')
        await page.getByRole('button', { name: 'حفظ العناوين' }).click()
        await page.getByRole('button', { name: 'تعديل كل العناوين' }).waitFor({ timeout: 10_000 }).catch(() => {})
        const bulk = await db.clip.findFirst({ where: { albumId: album.id }, select: { titleEn: true } })
        report('the bulk title form saves', bulk?.titleEn === 'Dunes at sunset', String(bulk?.titleEn))
        report('no errors on the upload flow', errors.length === 0, errors.slice(0, 2).join(' | '))

        await page.goto(`${BASE}/studio/releases`, { waitUntil: 'networkidle' })
        const card = page.locator('section', { hasText: 'تصريح اختبار الرفع' })
        await card.locator('input[type="file"]').setInputFiles(scan)
        await card.getByText('flow-permit.pdf').waitFor({ timeout: 15_000 }).catch(() => {})
        const withDoc = await db.release.findUnique({ where: { id: release.id } })
        report('a release scan attaches from its card', Boolean(withDoc?.fileUploadedAt) && withDoc!.fileKey.startsWith('documents/'))
        await page.close()

        const adminOpen = await adminContext.request.get(`${BASE}/api/studio/releases/${release.id}/document`, { maxRedirects: 0 })
        report('an admin opens the scan through the private route', [200, 302].includes(adminOpen.status()), String(adminOpen.status()))

        // DEV-19: the reviewer verifies the release from the review page.
        if (clip) await db.releaseClip.create({ data: { releaseId: release.id, clipId: clip.id } })
        const task = await db.reviewTask.create({ data: { albumId: album.id, status: 'in_progress' } })
        const reviewPage = await adminContext.newPage()
        await reviewPage.goto(`${BASE}/admin/review/${task.id}`, { waitUntil: 'networkidle' })
        await reviewPage.getByRole('button', { name: 'اعتماد', exact: true }).first().click()
        await reviewPage.getByText('اعتُمد التصريح.').first().waitFor({ timeout: 10_000 }).catch(() => {})
        const decided = await db.release.findUnique({ where: { id: release.id }, select: { verification: true, verifiedAt: true } })
        report('an admin verifies a release from the review page', decided?.verification === 'verified' && Boolean(decided?.verifiedAt), String(decided?.verification))
        await reviewPage.close()
        await db.reviewTask.delete({ where: { id: task.id } }).catch(() => {})
      } finally {
        const clips = await db.clip.findMany({ where: { albumId: album.id } })
        const page = await creatorContext.newPage()
        for (const clip of clips) {
          await page.request.delete(`${BASE}/api/studio/uploads/${clip.id}`).catch(() => {})
        }
        // A verified release's scan cannot be removed (by design) — reopen it first.
        await db.release.update({ where: { id: release.id }, data: { verification: 'pending' } }).catch(() => {})
        await page.request.delete(`${BASE}/api/studio/releases/${release.id}/document`).catch(() => {})
        await page.close()
        await db.release.delete({ where: { id: release.id } }).catch(() => {})
        await db.album.delete({ where: { id: album.id } }).catch(() => {})
      }
    }
    rmSync(dir, { recursive: true, force: true })
    await db.$disconnect()
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
      ['/admin/users', 'admin'],
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

  // ── Admin: find a user by email and open their account ───────────────────
  {
    const page = await adminContext.newPage()
    const errors = watchErrors(page)
    await page.goto(`${BASE}/admin/users?q=${encodeURIComponent('buyer@agency')}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForTimeout(800)
    const rows = page.locator('[data-user-row]')
    report('user search finds the buyer by email', (await rows.count()) === 1, `${await rows.count()} row(s)`)
    if ((await rows.count()) > 0) {
      await rows.first().click()
      await page
        .waitForURL((url) => /^\/admin\/users\/[^/]+$/.test(url.pathname), { timeout: 15_000 })
        .catch(() => {})
      const text = await page.locator('main').innerText().catch(() => '')
      report('the user row opens the account page', /\/admin\/users\/[^/?]+$/.test(page.url()), page.url().replace(BASE, ''))
      report(
        'the account page renders its sections',
        ['الحساب', 'الطلبات', 'المكتبة', 'رسائل التواصل', 'عرض الموقع كهذا المستخدم'].every((s) =>
          text.includes(s),
        ),
      )
      report('the view-as form is offered for a buyer', (await page.locator('textarea[name="reason"]').count()) === 1)
    }
    report('no errors on the users flow', errors.length === 0, errors.slice(0, 2).join(' | '))
    await page.close()
  }

  // ── Admin: a price band edit persists, reprices nothing, and restores ────
  {
    const db = new PrismaClient()
    const band = await db.priceBand.findFirst({ orderBy: { priceStandard: 'asc' } })
    if (!band) {
      report('price band edit (no bands seeded)', true, 'skipped')
    } else {
      const original = Number(band.priceStandard)
      // The albums that exist NOW, by id: the database is shared, and another
      // session creating an album mid-run is not a reprice.
      const existing = (await db.album.findMany({ select: { id: true } })).map((row) => row.id)
      const albumPrices = async () =>
        JSON.stringify(
          await db.album.findMany({
            where: { id: { in: existing } },
            orderBy: { id: 'asc' },
            select: { id: true, priceStandard: true },
          }),
        )
      const items = (await db.orderItem.findMany({ select: { id: true } })).map((row) => row.id)
      const orderTotals = async () =>
        JSON.stringify(
          await db.orderItem.findMany({
            where: { id: { in: items } },
            orderBy: { id: 'asc' },
            select: { id: true, grossAmount: true, commissionRate: true, commissionAmount: true },
          }),
        )
      const albumsBefore = await albumPrices()
      const ordersBefore = await orderTotals()
      const started = new Date()

      const page = await adminContext.newPage()
      const errors = watchErrors(page)
      const setPrice = async (price: number, extra?: { minClips?: string; maxClips?: string }) => {
        await page.goto(`${BASE}/admin/catalogue`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(900)
        const row = page.locator(`[data-band-row="${band.tier}"]`)
        await row.getByRole('button', { name: 'تعديل' }).click()
        await row.locator('input[name="priceStandard"]').fill(String(price))
        if (extra?.minClips) await row.locator('input[name="minClips"]').fill(extra.minClips)
        if (extra?.maxClips) await row.locator('input[name="maxClips"]').fill(extra.maxClips)
        await row.locator('form button[type="submit"]').click()
        await page.waitForTimeout(1800)
        return row
      }

      // Invalid first: min above max is refused and nothing is written.
      const invalid = await setPrice(original + 7, { minClips: '90', maxClips: '40' })
      const unchanged = await db.priceBand.findUnique({ where: { id: band.id } })
      report(
        'band validation refuses min > max',
        Number(unchanged?.priceStandard) === original &&
          (await invalid.getByText('أقل عدد لقطات يجب ألا يتجاوز الأكثر').count()) > 0,
      )

      await setPrice(original + 1)
      const edited = await db.priceBand.findUnique({ where: { id: band.id } })
      report('band price edit persists', Number(edited?.priceStandard) === original + 1, `${original} → ${Number(edited?.priceStandard)}`)
      report('band edit reprices no existing album', (await albumPrices()) === albumsBefore)
      report('band edit touches no completed order', (await orderTotals()) === ordersBefore)
      report(
        'band edit is audited',
        (await db.auditLog.count({
          where: { action: 'priceband.update', entityId: band.id, createdAt: { gte: started } },
        })) > 0,
      )

      await setPrice(original)
      const restored = await db.priceBand.findUnique({ where: { id: band.id } })
      report('band price restores', Number(restored?.priceStandard) === original)
      report('no errors on the band flow', errors.length === 0, errors.slice(0, 2).join(' | '))
      await page.close()
    }
    await db.$disconnect()
  }

  // ── Admin: make a user a creator; after signing in they reach the studio ─
  // DEV-05. Middleware reads the role from the session cookie (edge, no
  // database), so a session opened BEFORE the promotion stays a buyer until
  // the user signs in again — the success message says so. The studio is
  // checked by its content, not its URL: a wrong role is a REWRITE to
  // /forbidden, which keeps /studio in the address bar.
  {
    const db = new PrismaClient()
    const run = Date.now()
    const email = `flows-maker-${run}@laqta.test`
    const handle = `flows-${run}`.slice(0, 30)
    const target = await db.user.create({
      data: { email, name: 'Flows Maker', passwordHash: await bcrypt.hash('Laqta!2026', 10), locale: 'ar' },
    })
    let targetContext: Awaited<ReturnType<typeof signIn>> | null = null
    try {
      const page = await adminContext.newPage()
      const errors = watchErrors(page)
      await page.goto(`${BASE}/admin/users/${target.id}`, { waitUntil: 'networkidle' })
      report('a buyer account offers «اجعله صانع محتوى»', (await page.locator('input[name="handle"]').count()) === 1)
      await page.fill('input[name="handle"]', handle)
      await page.fill('input[name="displayNameAr"]', 'صانع تجريبي')
      await page.fill('input[name="displayNameEn"]', 'Test Maker')
      await page.getByRole('button', { name: 'أنشئ حساب الصانع' }).click()
      await page.waitForTimeout(2500)

      const creator = await db.creator.findUnique({ where: { userId: target.id } })
      const role = (await db.user.findUnique({ where: { id: target.id }, select: { role: true } }))?.role
      report('the creator profile is created approved', creator?.status === 'approved', creator?.status ?? 'none')
      report('founding (the default) puts them on silver — 70%', creator?.tier === 'silver', creator?.tier ?? 'none')
      report('the account role becomes creator', role === 'creator', role ?? 'none')
      report(
        'the promotion is audited',
        (await db.auditLog.count({ where: { action: 'creator.create', entityId: creator?.id ?? '-' } })) === 1,
      )
      await page.reload({ waitUntil: 'domcontentloaded' })
      report('the form gives way to the creator panel', (await page.locator('input[name="handle"]').count()) === 0)
      report('no errors on the make-creator flow', errors.length === 0, errors.slice(0, 2).join(' | '))
      await page.close()

      // Mandatory 2FA: a new creator is held on /account/security until they
      // enrol, with the notice saying why, and nothing of the studio renders.
      targetContext = await signIn(browser, email)
      {
        const held = await targetContext.newPage()
        await held.goto(`${BASE}/studio`, { waitUntil: 'domcontentloaded' })
        const url = new URL(held.url())
        report(
          'unenrolled, the new creator is sent to the 2FA page',
          url.pathname === '/account/security' && url.searchParams.get('next') === '/studio',
          url.pathname + url.search,
        )
        report('  …which says why', (await held.locator('[data-two-factor="required"]').count()) === 1)
        await held.close()
      }
      await targetContext.close()
      await db.user.update({
        where: { id: target.id },
        data: { twoFactorEnabled: true, twoFactorSecret: 'LAQTAFLOWSMAKERTOTPSECRETFIXTURE' },
      })
      targetContext = await signIn(browser, email)
      const studio = await targetContext.newPage()
      await studio.goto(`${BASE}/studio`, { waitUntil: 'domcontentloaded' })
      const body = await studio.locator('main').innerText().catch(() => '')
      report(
        'enrolled and signed in, they reach the studio itself',
        new URL(studio.url()).pathname.startsWith('/studio') && !body.includes('الوصول غير مسموح') && body.length > 0,
        new URL(studio.url()).pathname,
      )
      await studio.close()
    } finally {
      await targetContext?.close()
      await db.auditLog.deleteMany({ where: { action: 'creator.create', detail: { path: ['userId'], equals: target.id } } })
      await db.user.delete({ where: { id: target.id } })
      await db.$disconnect()
    }
  }

  // ── Admin: an admin made a creator reaches the studio without re-login ──
  // The owner's own case. The admin role already passes middleware; the
  // creator profile reaches the session through the jwt callback's per-request
  // read (lib/auth.ts), so /studio no longer bounces to /sell.
  {
    const db = new PrismaClient()
    const run = Date.now()
    const email = `flows-admin-maker-${run}@laqta.test`
    const other = await db.user.create({
      data: {
        email,
        name: 'Flows Admin',
        role: 'admin',
        passwordHash: await bcrypt.hash('Laqta!2026', 10),
        locale: 'ar',
        // Enrolled: this checks the creator profile reaching the session, not 2FA.
        twoFactorEnabled: true,
        twoFactorSecret: 'LAQTAFLOWSADMINTOTPSECRETFIXTURE',
      },
    })
    const otherContext = await signIn(browser, email)
    try {
      const page = await adminContext.newPage()
      await page.goto(`${BASE}/admin/users/${other.id}`, { waitUntil: 'networkidle' })
      await page.fill('input[name="handle"]', `flows-a-${run}`.slice(0, 30))
      await page.fill('input[name="displayNameAr"]', 'مدير صانع')
      await page.fill('input[name="displayNameEn"]', 'Admin Maker')
      await page.getByRole('button', { name: 'أنشئ حساب الصانع' }).click()
      await page.waitForTimeout(2500)
      await page.close()
      const role = (await db.user.findUnique({ where: { id: other.id }, select: { role: true } }))?.role
      report('an admin made a creator keeps the admin role', role === 'admin', role ?? 'none')
      const studio = await otherContext.newPage()
      await studio.goto(`${BASE}/studio`, { waitUntil: 'domcontentloaded' })
      const path = new URL(studio.url()).pathname
      report('…and their open session reaches the studio, not /sell', path === '/studio', path)
      await studio.close()
    } finally {
      await otherContext.close()
      const creator = await db.creator.findUnique({ where: { userId: other.id }, select: { id: true } })
      if (creator) await db.auditLog.deleteMany({ where: { entityId: creator.id } })
      await db.user.delete({ where: { id: other.id } })
      await db.$disconnect()
    }
  }

  // ── Public: «قدّم كصانع محتوى» opens the contact form on «البيع على لقطة» ──
  {
    const page = await (await browser.newContext()).newPage()
    await page.goto(`${BASE}/sell`, { waitUntil: 'domcontentloaded' })
    const apply = page.getByRole('link', { name: 'قدّم كصانع محتوى' }).first()
    report('/sell Apply points at the contact form', (await apply.getAttribute('href')) === '/contact?topic=selling')
    await page.goto(`${BASE}/contact?topic=selling`, { waitUntil: 'networkidle' })
    report('the contact topic arrives preselected', (await page.locator('select[name="topic"]').inputValue()) === 'selling')
    await page.goto(`${BASE}/contact?topic=nonsense`, { waitUntil: 'networkidle' })
    report('an unknown topic leaves the select blank', (await page.locator('select[name="topic"]').inputValue()) === '')
    await page.context().close()
  }

  // ── Buyer: add a clip to a new board, share it, open it, remove, delete ─
  //
  // DEV-49: «أضف للوح» on the clip page used to land on a list that ignored
  // `?add=`. Through the real pages, as the seeded buyer.
  {
    const db = new PrismaClient()
    const clip = await db.clip.findFirst({ where: { album: { status: 'live' }, ingestStatus: 'ready' }, select: { id: true, slug: true } })
    const buyer = await db.user.findUnique({ where: { email: 'buyer@agency.sa' }, select: { id: true } })
    const name = `لوح اختبار ${Date.now()}`
    if (!clip || !buyer) {
      report('boards flow', false, 'seed clip or buyer missing')
    } else {
      const buyerContext = await signIn(browser, 'buyer@agency.sa')
      const page = await buyerContext.newPage()
      const errors = watchErrors(page)
      try {
        await page.goto(`${BASE}/footage/${clip.slug}`, { waitUntil: 'networkidle' })
        await page.getByRole('link', { name: 'أضف للوح' }).first().click()
        await page.waitForURL((url) => url.pathname === '/account/boards' && url.search.includes('add='), { timeout: 15_000 }).catch(() => {})
        await page.fill('input[name="name"]', name)
        await page.getByRole('button', { name: 'لوح جديد بهذه اللقطة' }).click()
        await page.waitForURL((url) => /\/account\/boards\/[^/]+$/.test(url.pathname), { timeout: 15_000 }).catch(() => {})
        const board = await db.board.findFirst({ where: { userId: buyer.id, name }, include: { clips: true } })
        report('a new board is created from the clip page, holding that clip', board?.clips.some((c) => c.clipId === clip.id) === true)

        if (board) {
          await page.getByRole('button', { name: 'شارك برابط' }).click()
          await page.getByRole('button', { name: 'أوقف المشاركة' }).waitFor({ timeout: 10_000 }).catch(() => {})
          const shared = await db.board.findUnique({ where: { id: board.id }, select: { isPublic: true, shareToken: true } })
          report('sharing a board makes it public', shared?.isPublic === true)
          const anon = await fetch(`${BASE}/boards/${shared?.shareToken}`, { redirect: 'manual' })
          report('the shared link opens without signing in', anon.status === 200, String(anon.status))

          await page.getByRole('button', { name: 'شيلها من اللوح' }).first().click()
          await page.getByText('اللوح فاضي').waitFor({ timeout: 10_000 }).catch(() => {})
          report('removing the clip empties the board', (await db.boardClip.count({ where: { boardId: board.id } })) === 0)

          page.once('dialog', (dialog) => dialog.accept())
          await page.getByRole('button', { name: 'احذف اللوح' }).click()
          await page.waitForURL((url) => url.pathname === '/account/boards', { timeout: 15_000 }).catch(() => {})
          report('deleting the board removes it', (await db.board.count({ where: { id: board.id } })) === 0)
        }
        report('no errors on the boards flow', errors.length === 0, errors.slice(0, 2).join(' | '))
      } finally {
        await db.board.deleteMany({ where: { userId: buyer.id, name } }).catch(() => {})
        await page.close()
        await buyerContext.close()
      }
    }
    await db.$disconnect()
  }

  await browser.close()
  console.log(failures ? `\n${failures} flow(s) failed.` : '\nEvery flow works.')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
