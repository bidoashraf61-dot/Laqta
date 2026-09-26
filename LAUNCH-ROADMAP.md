# Laqta — Launch Roadmap

The ordered pipeline from "built on one Mac" to "live and taking money".
Written 2026-09-26 from a full audit of the code, specs and docs.

**How to use this file**

- **Daily view:** the owner picks and ticks tasks on the Launch Path page
  (https://claude.ai/artifact/1MPK7uQK6q1oxtpWk9ZcSU). Its ticks live in the
  page database, collection `status` (one doc per task, e.g. `P0-1`, with
  `state` todo | today | done). **At the start of a session, read that
  collection (ArtifactData `list`) and copy any owner ticks into this file.**
  When a Claude session finishes a task, tick it here *and* write
  `{task, state: "done", at}` to that collection. Milestone dates are
  targets the owner can move.

- Work top to bottom. Phases 0 → 5 are in order; inside a phase, tasks can run
  in parallel unless a task says *needs*.
- **Who:** 🧑 = the owner (accounts, money, legal, content, decisions) ·
  🤖 = a Claude session (code, specs, gates) · 🤝 = both.
- A Claude session picks the **first unticked 🤖 task whose *needs* are met**,
  does it on a branch, updates the spec + this file + `HANDOFF.md` in the same
  commit, and merges to `main` with `--no-ff`.
- Tick a task as `- [x] … — done 2026-10-02, commit abc1234`.
- 🧑 tasks in Phase 1 take **weeks of waiting** (Paymob, lawyer, accountant,
  DNS). Start them today, in parallel with everything else.

---

## M1 — Safe & backed up · target 3 Oct (Phase 0)

- [ ] **P0.1 🤖 Close the phone sign-in hole.** With no SMS provider, the
  one-time code is sent back to the browser and shown on the form
  (`app/(public)/sign-in/actions.ts`, `lib/otp.ts`). On a live site anyone
  could sign in as any phone number. Fix: never return the code in
  production, and hide the phone tab until a real SMS provider is set.
  Add a gate to `verify:auth` that fails if the code can reach the browser in
  production mode. *Recommended: launch with email sign-in only.*
- [ ] **P0.2 🧑 Back up the code off this Mac.** There is no git remote — if
  this laptop dies, the project is gone. Create a **private** GitHub
  repository and push `main` (a Claude session can do the push once the
  repo exists).
- [ ] **P0.3 🤖 Tidy git.** 69 local branches (all merged) and old worktrees.
  Delete merged branches and prune worktrees; ask the owner before touching
  `laqta-worktrees/foundation` (it has uncommitted edits from August).
- [ ] **P0.4 🤖 Fix stale docs so no session builds on a lie.**
  `README.md` (says Arabic-only, "upload UI not built", SAR commission
  thresholds, 22-clip album), `.env.example` (`DEFAULT_CURRENCY="SAR"`,
  `MIN_PAYOUT_SAR`, unused `MEILI_*`), the four files in `docs/decisions/`
  (status lines say "not built" though A and most of C are), and
  `docs/business/build-steps.md` (Saudi CR / Moyasar / ZATCA — superseded by
  Egypt company + Paymob).

## M2 — Accounts & answers in · target 24 Oct (Phase 1 — start now, they take weeks)

Nothing here is code. Each one unblocks a later 🤖 task.

**Money**
- [ ] **P1.1 🧑 Paymob.** Get written confirmation that your account can charge
  **USD** to **Saudi cards** (and whether mada works). Then collect the
  `PAYMOB_*` keys. Checklist: `specs/api/payments-paymob.md`.
- [ ] **P1.2 🧑 Bank-transfer details** for the order email (`BANK_*` in
  `.env.example`) — account name, IBAN/SWIFT, bank name.
- [ ] **P1.3 🧑 Accountant answers** to `docs/business/tax-questions-for-accountant-ar.md`:
  VAT on USD sales to Saudi buyers, Egyptian e-invoice/e-receipt, invoice
  currency, credit notes, withholding tax on creator payouts. The terms page
  currently promises Saudi VAT and an e-invoice on every purchase — that
  promise must match the answer.

**Legal**
- [ ] **P1.4 🧑 Lawyer review** of terms, privacy, licences and content policy
  (`content/legal.ts`), in both languages. Also ask: trademarked buildings in
  AI footage (Album 1 question), and Egypt vs Saudi governing law.
- [ ] **P1.5 🧑 Privacy decisions (PDPL):** (a) account deletion + data export —
  self-serve button, or "email us" handled manually? (b) cookie banner —
  needed if there are no analytics? (c) where the server and database live
  (hosting region). *Recommended: manual deletion/export by email at launch,
  no banner while there are no analytics, AWS Bahrain (me-south-1) or
  Frankfurt.*
- [ ] **P1.6 🧑 Creator agreement + release templates** — only needed if outside
  creators sell at launch. If launch albums are all yours, defer.

**Services**
- [ ] **P1.7 🧑 Domain.** Confirm the live domain (laqta.sa? .com?) and who
  controls its DNS.
- [ ] **P1.8 🧑 Resend.** Create the account, add the domain, publish the
  SPF/DKIM DNS records, create an API key (`specs/mail.md` §setup). Put the
  key in `.env` yourself — never paste it into chat.
- [ ] **P1.9 🧑 AWS.** Create the account + billing alarm. Buckets and
  CloudFront follow `docs/tech/media-aws.md` (a Claude session can walk you
  through each screen).
- [ ] **P1.10 🧑 Sentry.** Create a free account + project; keep the DSN
  (`docs/tech/sentry.md`).
- [ ] **P1.11 🤝 Hosting choice.** The site needs Node, Postgres, **ffmpeg** and
  a **Chromium** (licence PDFs). *Recommended: one Docker container on a host
  with managed Postgres + daily backups, in the same region as the S3
  buckets.* Claude proposes 2 options with monthly cost; you pick.
- [ ] **P1.12 🧑 Contact details:** WhatsApp, support email, company legal name,
  Egyptian address, commercial registration number (`content/contact.ts`).

## M3 — Launch features built · target 31 Oct (Phase 2)

- [ ] **P2.1 🤖 Wire Sentry** — install `@sentry/nextjs`, connect to the
  privacy scrubber in `lib/observability.ts`, report from `app/error.tsx`.
  *needs P1.10 for the live test; code can land before.*
- [ ] **P2.2 🤖 Fix legal-copy clashes:** content policy says albums need
  "no fewer than eight clips" (rule is 30–70); header asks for Saudi counsel
  while governing law is Egypt; VAT/e-invoice sentences. *needs P1.3, P1.4.*
- [ ] **P2.3 🤖 Re-cut price bands to 30–70 clips** — all four seeded bands sit
  outside the rule (`specs/admin/README.md`). Owner sets the prices.
- [ ] **P2.4 🤖 Production seed.** A separate script that loads only real
  data: taxonomy, price bands, licence versions, the admin account. No demo
  albums, invented ratings or view counts. The current `prisma/seed.ts` stays
  for development only.
- [ ] **P2.5 🤖 Security hardening:** suspending a user must end their live
  session (today it only blocks new sign-ins); rate limiting on sign-in,
  sign-up and checkout; a Content-Security-Policy header.
- [ ] **P2.6 🤖 Privacy features** as decided in P1.5 (deletion/export flow or
  the manual procedure in the privacy page).
- [ ] **P2.7 🤖 Remove or finish half-wired controls** a buyer can see:
  "Add to board" on the clip page does nothing; promo codes exist in admin but
  are never read at checkout (hide the field or wire it). The waitlist has no
  reader screen — add a simple list/CSV in admin.
- [ ] **P2.8 🤖 Paymob refunds made in the Paymob dashboard** must reverse the
  Laqta ledger (today they are only flagged). *needs P1.1.*
- [ ] **P2.9 🤖 Deploy setup:** Dockerfile (Node + ffmpeg + Chromium), health
  check, `prisma migrate deploy` on release, env checklist, backup schedule.
  *needs P1.11.*

## M4 — Real catalogue ready · target 14 Nov (Phase 3)

- [ ] **P3.1 🧑 Produce the launch albums** — 4–5 albums of 30–70 clips each
  around one subject. Album 1 «فوق الغيم» plan:
  `docs/production/album-01-decision-and-shot-list.md`.
- [ ] **P3.2 🤝 Media pipeline per album:** masters → `npm run media:previews`
  (watermarked previews + posters) → trailer cut → `npm run media:upload`.
  *needs P1.9.*
- [ ] **P3.3 🧑 Hero film, showreel and "problem" section video** — today the
  showreel reuses the hero film and the problem section is a placeholder.
  Upload to the CDN so a deploy is not missing the film.
- [ ] **P3.4 🤖 Load albums into production** through the studio / admin
  (not the seed), with Arabic + English titles, taxonomy, trailer, price.
- [ ] **P3.5 🧑 Pick the free sample album clips** (signed-in users only).
- [ ] **P3.6 🧑 (Optional) a real testimonial** — only a real, attributable
  quote; otherwise the section stays out.

## M5 — Rehearsal passed · target 21 Nov (Phase 4)

- [ ] **P4.1 🤖 Staging deploy** on the chosen host with real env (Paymob in
  test mode). Run `npm run verify` against it — every gate green.
- [ ] **P4.2 🤝 End-to-end rehearsal on staging** as a real buyer: sign up →
  browse → buy by card → buy by bank transfer (admin settles) → receive
  both emails → download → licence PDF opens. Then as a creator: upload →
  review → approve → email arrives.
- [ ] **P4.3 🤝 Email deliverability:** order, reset-password and approval
  emails land in Gmail and Outlook inboxes (not spam), in Arabic and English.
- [ ] **P4.4 🧑 Real-money test:** one live card purchase with your own card,
  then refund it. Check the Paymob dashboard and the Laqta ledger agree.
- [ ] **P4.5 🤖 Phone + desktop pass** of every public page in both languages
  (`npm run audit`), plus a manual look at the landing on a real iPhone.
- [ ] **P4.6 🤝 Backups proven:** restore last night's database backup into a
  scratch database once.

## M6 — Live · soft launch 24 Nov, public 8 Dec (Phase 5)

- [ ] **P5.1 🤝 Production deploy**, domain pointed, SSL on, production seed
  run once, albums loaded (P3.4).
- [ ] **P5.2 🧑 Soft launch** — share with 10–20 trusted freelancers/agencies
  for a week. Watch Sentry and `/admin/orders` daily.
- [ ] **P5.3 🧑 Public launch.**
- [ ] **P5.4 🤖 First-two-weeks watch:** daily check of Sentry, outbox
  (failed emails), zero-result searches (`/admin/reports`) — the last one is
  the list of albums to make next.

---

## After launch (not blocking)

- Album intake & pricing negotiation — decision B (`docs/decisions/2026-08-20-album-intake-pricing-design.md`):
  admin sets price, creator accepts. Needed once **outside creators** sell.
- Admin as CMS — decision D: legal pages and settings editable from admin.
- Accounting CSV exports; reprice-live-albums-and-notify step.
- mada / Tabby / Tamara; HLS streaming previews.
- Egyptian e-invoicing via a certified provider (never by hand) — per P1.3.
- Team accounts; analytics (then a cookie banner).
- Studio: edit clip metadata beyond titles; edit/delete a release.
