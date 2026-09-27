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
- «تصوير» only where it is true — the catalogue is **AI-generated + filmed**
  (D1/D3, 2026-09-26). Never describe generated footage as filmed. Never claim
  "no AI", "first" or "largest", or «الأرخص».
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
| 2026-09-26 | D1–D10 answered (`checklists/README.md`): **AI + filmed** footage; «ترخيص دائم»; «تصوير» allowed where true; albums **$49–$249**; resolution **per album** (no blanket 4K); dedicated vertical albums; **VAT stays 15%** until the accountant answers; founding creators **70%**; studio Arabic only; **Google Analytics** (replaces "no analytics", so a cookie banner is now required) |
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
- Remote `origin` on GitHub (public). Only `main` exists — old branches and
  the abandoned `laqta-worktrees/foundation` checkout were deleted 2026-09-26
  (DEV-03).

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

## 11. Session — 2026-09-26 (DEV-03, DEV-04)

- **DEV-03 done:** deleted the 70 local branches already merged into `main`
  (only `main` was ever pushed), then — with the owner's yes — the abandoned
  `laqta-worktrees/foundation` worktree (1.1 GB, branch `feat/foundation`,
  fully merged; its 15 uncommitted August edits were discarded).
- **DEV-04 done:** README rewritten where stale (bilingual site, USD, studio
  uploads built, phone sign-in off, "Foundation owns" section replaced by the
  current change rules); `.env.example` drops unread vars (MEILI_*,
  DEFAULT_CURRENCY, MIN_PAYOUT_SAR, SMS_SENDER_ID) and says Sentry is not yet
  installed; the four `docs/decisions/` status lines now say what is built;
  `docs/business/build-steps.md` marked superseded with what changed. Specs
  `studio-payouts`, `admin-settings`, `sell` still said SAR 500 / SAR tiers —
  fixed to the code (USD 100, USD 12.5k / 50k).
- Noticed: `VAT_RATE` defaults to 0.15 but decision D7 recommends 0% until the
  accountant answers — set when D7 is decided.

## 12. Session — 2026-09-26 (decisions, ALB-20)

- D1–D10 answered and recorded (see §3 and `checklists/README.md`).
- **ALB-20 drafted:** `docs/creators/creator-brief-{ar,en}.md` +
  `qa-log-template.csv` — founding offer (70%, $49–$249, $100 minimum, 30-day
  hold), one subject / 30–70 clips / one origin (AI or filmed, never mixed —
  `Album.origin` is per album) / one shape, tech spec from `lib/uploads.ts`
  (.mov/.mp4, H.264/H.265/ProRes, 20 GB), Saudi-accuracy and AI-fault checks,
  releases and permits from `lib/review-checklist.ts`, banned list from the
  content policy. Placeholders: deadline (ALB-23) and contact email.
  **Waiting for owner approval.**
- Found: `/content-policy` (content/legal.ts) still says albums of «no fewer
  than eight clips» — contradicts 30–70. Fix with DEV-20.
- The 70% founding share needs no new code: the **silver** tier is 30%
  commission = 70% to the creator. Set founding creators to silver in admin
  (and note that silver is normally earned at USD 12.5k lifetime).

## 13. Session — 2026-09-26 (DEV-06)

- **DEV-06 done — blank licence fixed.** Studio albums were created with no
  `licenceVersionId`, and checkout copied the album's pointer onto the order,
  so a creator album would have sold with no licence text (and a blank
  certificate). Now `lib/licence.currentLicenceId()` is set at album creation
  (studio) and approval (`lib/admin.decideReview`), and checkout freezes the
  **current** licence on every line — refusing to sell if none is current.
  `npm run repair:licences` also fills blank albums/order items (ran locally:
  2 albums fixed). `verify:licence` now fails on any album or order item
  without a licence. **Run `npm run repair:licences` once on the production
  database when it exists.**
- Album production moved to the `Laqta Albums` folder; this project covers the
  portal only. ALB-01 decided (AI, 50 × 10 s, 1080p, 24 fps).

## 14. Session — 2026-09-27 (DEV-05)

- **DEV-05 done.** `/admin/users/[id]` has «اجعله صانع محتوى»: handle, AR/EN
  display names, country, «صانع مؤسس» (default on → silver tier = 70%).
  Creates an approved `Creator`, sets role `creator` (admins keep `admin`),
  audits `creator.create`. `/sell` «قدّم كصانع محتوى» → `/contact?topic=selling`
  (topic preselected). The `jwt` callback now applies role + `creatorId` from
  its existing per-request read, so the owner can make their own admin account
  a creator and open `/studio` at once. **A buyer promoted while signed in must
  sign in again** — middleware reads the cookie role; the success message says
  so. `verify:flows` covers both cases on throwaway accounts.
- To use it yourself: `/admin/users` → find your account → «اجعله صانع محتوى».

## 15. Session — 2026-09-27 (DEV-09)

- **DEV-09 done — you set every album's price.** Creators no longer choose a
  band; a new album is created unpriced (`priceStandard = 0`) and the studio
  shows «يُحدَّد السعر عند الاعتماد». On `/admin/review/[id]` a required
  «سعر الألبوم» field (USD 49–249) is pre-filled from the band for the clip
  count; `decideReview` re-checks the range and writes price, USD and tier.
  Checkout refuses any unpriced album. Bands re-cut in the seed and the local
  database: 30–39 $79 · 40–49 $119 · 50–59 $159 · 60–70 $199 (suggestions
  only; editable on `/admin/catalogue`, which now enforces 49–249). `/sell`
  FAQ states $49–$249. New gate `npm run verify:pricing` (in `npm run verify`).
- Still not built: Spec B (the creator accepts the price before going live).

## 16. Session — 2026-09-27 (DEV-08 + price calculator)

- **Owner's pricing model** (recorded in `checklists/README.md` D4): price =
  clip-count base × resolution (720p 0.6 · 1080p 1 · 4K 1.3) × footage type
  (AI live action 1 · AI 3D 0.9 · AI 2D 0.8 · filmed 1.25) × quality
  (standard 0.9 · good 1 · exceptional 1.15), $49–$249. Creator rates quality
  and recommends a price within ±15%. **Approving the album approves the
  price; a counter-price travels with «طلب تعديل» feedback** and the creator
  resubmits — no separate acceptance step (owner, 2026-09-27; DEV-09b). **720p accepted.**
- **DEV-08 done.** «تفاصيل الألبوم» on `/studio/albums/[id]`: footage type,
  resolution, quality, orientation, category, locations, time of day, occasion,
  style tags, permits statement, and a live price calculator with the
  creator's recommended price + reason. Same form, editable in any status, on
  `/admin/review/[id]`, whose price field now pre-fills the recommendation.
  Submission requires saved details and an in-range recommendation. Two
  migrations (`album_details`, `album_pricing_inputs`). Search `?tag=` now
  matches album tags. Content policy: 720p/1080p/4K and 30–70 clips (was
  «ثماني لقطات»). Creator brief updated (720p, calculator table).
- Local database migration history was out of step (older changes applied
  by `db push`); reconciled with `prisma migrate resolve` — status clean.

## 17. Session — 2026-09-27 (DEV-09b)

- **DEV-09b done.** On `/admin/review/[id]` an album with a creator
  recommendation shows «سعر الصانع» (read-only) — «اعتماد» publishes at it —
  and an optional «سعرك المقترح» that goes with «طلب تعديل» (typing one
  disables approve). Stored as `ReviewTask.proposedPrice` (migration
  `review_proposed_price`), carried by the `album.changes` email, shown in the
  studio's changes panel, and pre-filled into the creator's price field; the
  creator may accept it even outside the calculator range. No separate
  acceptance step.

**Next:** DEV-09c (owner edits the calculator multipliers in admin), then the
remaining M2 tasks (DEV-10, 11, 12, 13, 17, 18, 19; DEV-07 waits on BIZ-09). Owner: approve the creator
brief, send BIZ-02/03/04. Claude's remaining M1
work waits on those (MKT-02 needs MKT-01; MKT-04 competitor price sheet and
ALB-20 creator brief draft can start any time).
