# Laqta — Handoff

Everything the next session (or person) needs to pick up this project cold.
**Refresh the "Current state" and "Last session" sections at the end of every
session.** Rules live in `CLAUDE.md`; the task lists live in `checklists/`.

_Last updated: 2026-09-26 (DEV-01)_

---

## 1. What Laqta is

- **Product:** Arabic-first marketplace for **AI-generated Saudi stock footage**
  (لقطة = "shot"). Headline: «مكتبة لقطات السعودية».
- **Model:** buyers discover at the **clip** level, buy at the **album** level.
  Albums only — no single clips, no packs. 30–70 clips around one subject.
  One-time purchase, perpetual licence, **no subscription**. Prices in **USD**.
- **Audience:** freelancers and agencies, no geographic limit.
- **Supply at launch:** the owner's first album (**Ramadan**) plus ~6 albums
  from outside AI-video creators, who sign up and upload through the studio.
- **Company:** registered in **Egypt**. Owner operates it **alone** and is not a
  developer.
- **Main competitor reference:** Artlist (subscription). Laqta's pitch: real
  Saudi look reviewed for accuracy, own-it-not-rent-it, full commercial licence.

### Copy rules that are easy to break
- Never «تصوير» or any ص-و-ر form — the footage is generated, not filmed. Never
  claim "no AI", "first" or "largest", or «الأرخص».
- **No refund copy anywhere public** — not a policy, not "no refunds".
- Plain claims over metaphor (`docs/content/brand-voice-ar.md`).

## 2. Current state (2026-09-26)

**Built and working locally (all verify gates green at last merge):**
public catalogue + landing (hero cinematic, footage wall, trailers section),
album/clip pages, Arabic search, cart, checkout, bank-transfer payment with
admin settle, library + signed downloads, licence certificate PDFs, boards,
free sample album, watermarked preview downloads, contact form, password
reset, creator studio (albums, clip uploads with ffprobe, release scans,
earnings, payouts), admin (review queue with enforced checklist, catalogue,
orders, refunds, payouts + payout runs with bank/Wise/Payoneer exports,
users + read-only view-as-user, price-band editor, taxonomy, reports),
English site under `/en`, transactional email outbox.

**Built but switched off — waiting for the owner's accounts/keys:**

| Service | State | Unblocked by |
|---|---|---|
| Paymob card + Apple Pay | code done, dormant | `PAYMOB_*` env — BIZ-04 |
| Resend email | code done, mail queues in outbox | account + DNS + key — BIZ-13 |
| AWS S3 + CloudFront | drivers done, local fallback | AWS setup — BIZ-06, DEV-15 |
| Sentry | privacy scrubber only; SDK not installed | BIZ-08 + DEV-50 |
| SMS for phone sign-in | **not built** — phone sign-in switched off (DEV-01 done); email only | an SMS provider (post-launch) |
| Hosting / deploy | **nothing exists** — no Dockerfile, CI or server | BIZ-07 + DEV-14 |

**Launch blockers (details in `checklists/`):**
1. ~~Phone sign-in hole~~ — **closed 2026-09-26 (DEV-01).** Phone sign-in is
   off until an SMS provider is built; sign-in is email only.
2. ~~No backup~~ — **closed 2026-09-26 (BIZ-01, DEV-02).** Repo
   `git@github.com:bidoashraf61-dot/Laqta.git` (remote `origin`, SSH). Only
   `main` is pushed; push `main` after every merge. **The repo is PUBLIC** —
   the owner's choice for now (2026-09-26), after being told it exposes the
   business docs, the Thmanyah font files, the seed password and the known
   weak spots listed here. Recommended: make it private before launch.
3. No real footage — every album is seed/demo data; previews are hero-film
   stand-ins, no trailers. Phase 3.
4. Legal text unreviewed; accountant answers missing; contact details empty.
5. No hosting, no production database, no production seed.

## 3. Key decisions already made (do not re-open without the owner)

| Date | Decision |
|---|---|
| 2026-08-03 | Hero film: 12 stills, overnight-arrival arc, cloud-wipe joins |
| 2026-08-05 | All UI through Impeccable + `DESIGN.md` (hard rule) |
| 2026-08-06 | Landing is albums-only, 7 sections, hides a thin catalogue (no counts) |
| 2026-08-20 | Album intake: admin sets price, creator must accept (not built — post-launch) |
| 2026-08-20 | Impersonation is read-only, audited, expiring (built) |
| 2026-09-23 | No refund page or refund copy on the public site |
| 2026-09-24 | Paymob, Resend, AWS S3 + CloudFront chosen |
| 2026-09-24 | USD only; albums only; 30–70 clips; verticals as dedicated vertical albums |
| 2026-09-24 | Free sample album + watermarked preview downloads for signed-in users |
| 2026-09-24 | No analytics at launch; team accounts after launch |
| open | PDPL deletion/export + cookie banner; hosting region; tax treatment |

Full reasoning: `docs/decisions/`, `docs/business/saudi-stock-footage-portal-plan.md`.

## 4. How it is built

- **Stack:** Next.js App Router + TypeScript + Tailwind, Postgres via Prisma,
  Auth.js v5 (email+password, phone OTP, TOTP 2FA for creator/admin).
- **Languages:** Arabic on the bare path (`/albums`), English via a middleware
  rewrite (`/en/albums`). Contract: `specs/localisation.md`.
- **Two frozen invariants** (`lib/orders.ts`): what a buyer owns is the
  snapshot at purchase (`OrderItem.clipManifestSnapshot`); commission is frozen
  at purchase. Never recompute either.
- **Media:** every poster/preview/trailer/hero goes through `lib/media.ts#mediaUrl`.
  Pipeline: `npm run media:previews` → `npm run media:upload`.
- **Design:** `DESIGN.md` + `.impeccable/design.json` (normative),
  `docs/design/design-language.md` (why). Thmanyah type, gold used sparingly.
- **Specs:** one per route in `specs/` — 58 page routes + API handlers, all covered.

## 5. Run it locally

```bash
npm install
npm run db:start
npm run db:migrate
npm run db:seed
npm run dev
```

Opens at http://localhost:3000. Seeded logins (development only) are listed in
`README.md` → "Seeded accounts". Secrets live in `.env` (git-ignored, never
committed, never pasted into chat); `.env.example` lists every variable.

**Checks before merging** (details in `CLAUDE.md` and `TESTING.md`):
`npm run build`, `npm run lint`, `npm run verify` (browser gates need
`npm start` running).

## 6. Where things are

See the folder map in `CLAUDE.md`. In short: website code at the root;
`specs/` = truth per route; `docs/` = business, content, design, tech,
decisions; `brand/` = logo and type; `production/` = footage-making files
(stills, storyboards, prompts, references — ~1 GB, git-ignored media).

## 7. Git

- Work on a branch, merge to `main` with `--no-ff`. `main` is the checkout in
  the project folder.
- **No remote yet** (BIZ-01). ~69 old local branches, all merged (DEV-03).
- `laqta-worktrees/foundation` is an abandoned August checkout with
  uncommitted edits — ask the owner before deleting.

## 8. Last session — 2026-09-26

- Reorganised the project folder: non-code files moved into `brand/`,
  `production/`, `tools/skills/` and `docs/{business,content,design,tech,decisions,production,archive}/`;
  every path reference in code, specs and docs updated; `.gitignore` follows
  the new paths. No website behaviour changed.
- Added "Start here" + folder map to `CLAUDE.md`; fixed its stale
  "Arabic-only" line.
- Wrote `LAUNCH-ROADMAP.md` from a full launch-readiness audit.
- Wrote this file.
- Removed the five merged, clean agent worktrees in `.claude/worktrees/`.

- Published the Launch Path page (six milestones, daily picks, ticks saved
  to its database): https://claude.ai/artifact/1MPK7uQK6q1oxtpWk9ZcSU

## 9. Session — 2026-09-26 (continued)

- Ran five audits (live site checks — all gates green; Arabic content; SEO
  and blog; outside-creator readiness; business and operations).
- Replaced `LAUNCH-ROADMAP.md` with four checklists in `checklists/`
  (portal, album, marketing, business & legal; 157 tasks, M1–M6).
- **Plan changes:** the first album is now **Ramadan** (not «فوق الغيم»);
  launch includes **~6 albums from outside creators**, so creator onboarding
  (DEV-05 – DEV-16) and the test site move to M2 (20 Oct).
- The Launch Path page published earlier
  (https://claude.ai/artifact/1MPK7uQK6q1oxtpWk9ZcSU) uses the old task
  numbers and is superseded by `checklists/`.

## 10. Session — 2026-09-26 (DEV-01)

- **DEV-01 done.** Phone sign-in is switched off until an SMS provider exists
  (`phoneSignInEnabled()` in `lib/otp.ts`, checked in the Auth.js `phone`
  provider, the send-code actions and the pages). `/sign-in` shows the email
  form only; the forgot-password phone hint and the profile's mobile
  verification row are hidden. The code is never sent to a browser.
  Owner confirmed: **email only is enough for launch.**
- `verify:auth` now checks the rail is shut (a correct code does not sign in).
  verify:auth, verify:arabic, verify:i18n, verify:flows, audit, build, lint green.
- Fixed copy: the mobile-code message said "ten minutes"; codes last five.
- Found, not fixed: email verification on `/account/profile` still returns the
  link to the browser when no mail provider is set, even in production — lets a
  user mark an address they don't own as verified. Low risk; small follow-up.

- **BIZ-01 / DEV-02 done.** Code pushed to the private GitHub repo
  (`origin`, SSH — the Mac's `~/.ssh/id_ed25519` is authorised; there is no
  `gh` CLI or HTTPS credential). Checked first: repo private, no `.env` or keys
  ever committed.

**Next:** owner answers D1–D10 and sends BIZ-02/03/04; Claude can do DEV-03
(delete merged branches) or DEV-04 (stale docs).
