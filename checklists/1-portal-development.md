# 1 · Portal development checklist

The website itself. Most tasks are 🤖 — ask Claude to do them on a branch.
Every change follows `CLAUDE.md`: spec updated in the same commit, UI through
Impeccable, `npm run verify` green. Key and milestones: [README](README.md).

## M1 — Safe · by 3 Oct

- [x] **DEV-01** ⛔ Turn off phone sign-in until an SMS provider exists — today the login code is shown in the browser, so anyone could sign in as any phone number. Add a check to `verify:auth`. — 🤖 · ½ day — done 2026-09-26 (email only at launch, owner confirmed)
- [x] **DEV-02** Push the code to the private GitHub repo — 🤖 · 15 min · *needs BIZ-01* — done 2026-09-26 (`main` → github.com/bidoashraf61-dot/Laqta, over SSH)
- [x] **DEV-03** Tidy git: delete the ~69 merged branches; ask before deleting `laqta-worktrees/foundation` — 🤖 · 1 hr — done 2026-09-26 (70 merged branches + the `foundation` worktree, owner approved)
- [x] **DEV-04** Fix stale docs: README (Arabic-only, SAR, "upload not built"), `.env.example` (SAR, unused MEILI), `docs/decisions/` status lines, `docs/business/build-steps.md` — 🤖 · ½ day — done 2026-09-26 (also fixed SAR→USD payout/tier lines in 3 specs)

## M2 — Ready for outside creators · by 20 Oct

Today nobody can become a creator, and creator albums would sell with a blank licence.

- [x] **DEV-05** ⛔ Admin button "make this user a creator" on `/admin/users/[id]` (use it for your own account too). Point "Apply" on `/sell` to the contact form. — 🤖 · 1 day — done 2026-09-27 (founding = silver tier, 70%; a signed-in buyer must sign in again)
- [x] **DEV-06** ⛔ Fix the blank licence: set the commercial licence on every album at creation and approval; repair existing ones — 🤖 · 2 hrs — done 2026-09-26 (checkout also freezes the current licence; `verify:licence` fails on any blank)
- [ ] **DEV-07** ⛔ Creator agreement acceptance — versioned, recorded, shown before the studio opens; exclusivity choice recorded — 🤖 · ½ day · *needs BIZ-09 text*
- [x] **DEV-08** ⛔ Album details form (creator + admin): AI-generated/filmed, orientation, location, category, time of day, tags, permits declaration. **Plus (owner, 2026-09-27): resolution (720p/1080p/4K), footage type (AI live action / AI 3D / AI 2D / filmed), quality self-rating, a live price calculator and the creator's recommended price.** Fix `/sell` copy that promises it. — 🤖 · 2 days · *needs D1* — done 2026-09-27 (details form + calculator on `/studio/albums/[id]`, editable by admin on `/admin/review/[id]`; submission requires it; `verify:pricing`)
- [x] **DEV-09** ⛔ Price control: admin sets the album price at approval; creators stop choosing a band. Re-cut price bands to 30–70 clips. Fix `/sell` FAQ + studio hint. — 🤖 · 1 day · *needs D4* — done 2026-09-27 ($49–$249 at approval; bands 30–39 $79 · 40–49 $119 · 50–59 $159 · 60–70 $199 as suggestions; `verify:pricing`)
- [x] **DEV-09b** ⛔ Price in the review round: approving the album approves its price (built); «طلب تعديل» can carry the owner's proposed price with the feedback; the creator sees both in the studio, updates the details (recommended price pre-filled with the proposal) and resubmits. No separate price-acceptance step (owner, 2026-09-27). Approve then sells at the creator's recommended price — a different price goes back as a proposal, not straight live — 🤖 · ½–1 day — done 2026-09-27 (`ReviewTask.proposedPrice`; approve sells at the recommendation; proposal disables approve; `verify:pricing`)
- [x] **DEV-09c** Owner controls the price calculator from admin — done 2026-09-27: dropdowns only (owner): importance grade low/medium/high for resolution, footage type and quality; price limits $29/$49/$69 – $199/$249/$299; creator margin ±10/15/20%; live example; audited
- [x] **DEV-10** Releases can link to any clip; per-clip "shows people / faces" toggle — 🤖 · ½ day — done 2026-09-27 (clip menu on the album page: «فيها أشخاص» / «وجوه واضحة» checkboxes, kept consistent, audited; faces clips flagged «تحتاج تصريح نموذج»; the release linker lists every clip of the creator, faces first, each marked)
- [ ] **DEV-11** 2FA required for creators before they reach the studio — 🤖 · ½ day
- [x] **DEV-12** Bulk edit of clip titles (today each defaults to the file name) — 🤖 · 1 day — done 2026-09-27 («تعديل كل العناوين» on the studio album page: every clip in one grid, Arabic + English side by side with the file name under each, one save in one transaction, only changed rows written, missing titles marked red)
- [ ] **DEV-13** Creator guide page: spec sheet, pre-start checklist, example album, linked from the upload area — 🤖 · ½ day · *needs ALB-20*
- [ ] **DEV-14** ⛔ Hosting: Dockerfile (Node + ffmpeg + Chromium), health check, migrations on deploy, daily database backups — 🤖 · 1 day · *needs BIZ-07*
- [ ] **DEV-15** ⛔ S3 buckets + CORS + CloudFront wired; Resend switched on — 🤝 · 1 day · *needs BIZ-06, BIZ-13*
- [ ] **DEV-16** ⛔ **Test site online** + upload one real multi-GB 4K master through S3 → processing → review → approval — 🤝 · 1 day · *needs DEV-14, DEV-15*
- [x] **DEV-17** AI-accuracy check added to the review checklist (warped buildings, garbled Arabic text, wrong dress, morphing, flicker) + translate the checklist to Arabic — 🤖 · 3 hrs — done 2026-09-27 (ninth check «دقة الذكاء الاصطناعي», blocking, «لا ينطبق» for filmed albums; every check's name, reason and prompts now Arabic from the dictionary; approval refusals read in Arabic; unit tests for the check and the copy)
- [ ] **DEV-18** Duplicate detection: compute the perceptual hash during processing — 🤖 · ½ day
- [x] **DEV-19** Admin can mark a release verified / rejected — 🤖 · 2 hrs — done 2026-09-27 («اعتماد» / «رفض» per release on the review page; verify needs the scan, reject needs a reason the creator reads; audited; `verify:flows` verifies one)

## Owner controls — requested 2026-09-27 (owner picks the timing)

The owner wants full control from the admin dashboard. What exists today: albums can
*show* a crossed-out price and offer label, but nothing in admin sets them; promo codes
can be created but checkout ignores them; there are no bundles, no way to change a live
album's price, and no way to edit site wording without a developer.

- [x] **DEV-60** Album offers: on `/admin/catalogue`, put any live album on offer — a sale price, a label (AR/EN) and start/end dates — and remove it; an «العروض» list of what is on offer now and next. Buyers already see offers on cards; checkout charges the sale price inside the dates. Creator share is on the price actually paid — 🤖 · 1 day — done 2026-09-27 (`lib/offers.ts`, dated offers decided at read time; row editor + «العروض» panel on `/admin/catalogue`; `verify:offers`)
- [x] **DEV-61** Special price: the owner can set any live album's regular price by hand (any amount, outside the calculator), audited; past orders keep what they paid — 🤖 · ½ day — done 2026-09-27 (row «السعر» on `/admin/catalogue`, `lib/album-price.ts`, live/paused only, must stay above a set offer; covered in `verify:offers`)
- [x] **DEV-62** Bundles: the owner builds a bundle of albums with a bundle price (or % off) and dates; a public bundle page and «اشترِ الحزمة» in the cart; the discount is split across the albums pro-rata so each creator's share and each licence stay correct — 🤖 · 2–3 days · *needs owner decision: bundle discount paid by Laqta or shared with creators* — done 2026-09-27: **Laqta pays** (owner). `/admin/bundles` + editor with a live who-pays split and the Laqta-share ceiling; `/bundles/[slug]` with «اشترِ الحزمة»; the bundle price applies automatically at checkout when every album is in the cart; creators paid in full; promo codes don't stack; `verify:bundles`
- [x] **DEV-63** ⛔ Promo codes that work: a code field at checkout that applies `/admin/promos` codes (window, cap, minimum, album limits), counts redemptions, and pays creators on the discounted price — today codes are created but never applied — 🤖 · 1 day — done 2026-09-27 (`lib/promos.ts`; code box at checkout with live preview; order + receipt carry the discount; `verify:promos`)
- [x] **DEV-64** Every word editable from admin (content-control design, `docs/decisions/2026-08-20-content-control-design.md`), in three phases with preview, both languages and revert — 🤖 · 6–8 days total — done 2026-09-27 (64a–c)
  - [x] **64a** Legal and long-form pages (Terms, Privacy, Licences, Content policy, About, Contact) — 2 days — done 2026-09-27 (`/admin/content` + editor with live AR/EN preview, publish with note, version history + restore; `DocumentVersion`, `lib/editable-documents.ts`; banned claims refused at publish; `verify:documents`)
  - [x] **64b** Landing, `/sell` and marketing copy, FAQ, emails — 2 days — done 2026-09-27 (`/admin/content/copy/[group]`: AR/EN side by side, live rule checks, preview on the real page via `?copyPreview`, publish, undo a publish; email preview; `CopyOverride` layer inside `translate()`; `verify:copy`)
  - [x] **64c** Every remaining interface string (~1,600 lines), with checks that an edit cannot blank a label, overflow its box or break Arabic direction — 2–3 days — done 2026-09-27, **visitor-facing only** by owner decision (5 more groups on `/admin/content/copy`: site, catalogue, checkout, account, contact; admin/studio labels stay in code; tight caps for buttons; `verify:copy`)



### Site copy (🤖 writes, 🧑 approves)
- [x] **DEV-20** ⛔ Review every «تصوير» / ص-و-ر form and "filmed/shot" wording (~25 places: origin badge «تصوير حقيقي», landing, `/sell`, studio, legal pages, meta keywords). **D1/D3 answered: AI + filmed**, so keep «تصوير» where it describes filmed footage; fix only places that call generated footage filmed or say the catalogue is AI-only. Remove blanket «4K» claims (D5: resolution stated per album) — 🤖 · ½ day — done 2026-09-27 (owner confirmed: mixed filmed/AI, resolution varies. No blanket claims left; badge «تصوير حقيقي» → «تصوير بالكاميرا»; album page now shows «طريقة الإنتاج» and «الدقة»; 720p chip; SEO description, FAQ, /sell fixed)
- [x] **DEV-21** ⛔ Replace "own it forever" with "permanent licence" (~12 places incl. the order email) — 🤖 · 2 hrs · *needs D2* — done 2026-09-27 (17 strings AR+EN incl. brand promise, SEO/hero, FAQ, footer, library, receipt email; `verify:licence` + the copy editor now refuse «لك للأبد» / «امتلاك دائم» / "yours for life")
- [x] **DEV-22** Clip-count grammar: "22 clip" → "22 clips"; Arabic «١٠ لقطة» → «١٠ لقطات»; «٣ صانع محتوى» — 🤖 · ½ day — done 2026-09-27 (`countOf` / `countLabel` / `useCount` in `lib/i18n` on `Intl.PluralRules`: all six Arabic forms incl. «١٥ ألبوماً», English one/other, for clips, albums, creators, results, ratings, previews, ZIPs, searches; ~25 call sites incl. cards, cart, library, boards, creator tiles, sample email; admin counts label-first; `verify:i18n` checks forms, worked cases, and refuses a number glued to a noun in copy or JSX)
- [x] **DEV-23** Saudi register fixes («أقدر»، «فاضي»، «ما فيه»، «تقدر») in FAQ, emails, empty states — 🤖 · 2 hrs — done 2026-09-27 (landing FAQ questions now Saudi-spoken — «أقدر أشتري…»، «فيه اشتراك شهري؟»، «وش أحمّل…»; album-approved email «تقدر تتابع»; 17 empty states «لا يوجد/لا توجد» → «ما فيه…»، «القائمة فاضية»; legal text left in MSA on purpose)
- [x] **DEV-24** Landing FAQ additions: "Is it AI-generated?", news use, team use, formats/vertical, custom album — 🤖 · 2 hrs — done 2026-09-27 (five more Q&As in AR + EN, 10 in all, in the FAQ JSON-LD too; custom album → the request form right below, no price promised (owner); news use allowed but AI clips never passed off as real events; team use = the buyer's licence, no shared accounts yet)
- [ ] **DEV-25** About page rewrite: AI disclosure, founder, company, founding date — 🤝 · ½ day · *needs BIZ-10 details*
- [ ] **DEV-26** ⛔ Legal pages rewrite after the lawyer: Terms, Privacy, Licences, Content policy (30–70 clips not "eight", AI section, Egyptian company, holy-sites rule, VAT line) — 🤖 · 1–2 days · *needs BIZ-02, BIZ-03*
- [ ] **DEV-27** ⛔ Licence certificate: real licence text (today 2 sentences), singular labels, licensor company line, drop "(optional)" — 🤝 · ½ day · *needs BIZ-02*
- [ ] **DEV-28** ⛔ Checkout VAT set per accountant (today adds 15% Saudi VAT; **D7: keep 15% until BIZ-03 answers**); FAQ invoice promise fixed or invoice PDF built — 🤖 · 2 hrs – 2 days · *needs D7 / BIZ-03*
- [x] **DEV-29** Remove "being activated" mada / Tabby / Tamara labels from checkout — 🤖 · 30 min — done 2026-09-27 (mada/Tabby/Tamara removed as payment methods and as copy; the «الدفع بالبطاقة قيد التفعيل» note is gone — bank-transfer-only checkout just shows bank transfer; the forged-method refusal reworded; `verify:payments` checks both)
- [ ] **DEV-30** Missing emails: verify-email on the template system (today Arabic-only), new sale to creator, payout paid, card failed/pending, bank-transfer reminder, contact + footage-request acknowledgements, creator added, launch notice — 🤖 · 1–2 days
- [x] **DEV-31** Refresh the writer briefs in `docs/content/` (still contain refunds, 10–24 clips, «مصوّر», SAR) — 🤖 · ½ day — done 2026-09-27 (both writer briefs rewritten to D1–D10: 30–70 clips, $49–$249 set at review, AI + filmed and never «تصوير» for AI, resolution per album, «ترخيص دائم» not ownership, no refund copy, no mada/Tabby/Tamara, plural rules now in code; `gemini/` re-exported from today's copy (18 parts); the August website draft and the two old reviews marked superseded)
- [ ] **DEV-32** Contact details shown on `/contact` and in site data — 🤖 · 30 min · *needs BIZ-10*

### SEO fixes
- [x] **DEV-33** ⛔ English album, clip, creator, collection and hub pages point Google at the Arabic page — use `localeAlternates` everywhere so each language is indexed — 🤖 · ½ day — done 2026-09-27 (6 page types + hub; locale resolved before metadata; `og:locale` per language; root layout's wrong inherited hreflang removed; robots.txt covers `/en` private pages; boards/forbidden noindex; new gate `verify:seo`)
- [x] **DEV-34** Sitemap sends theme/tag terms to `/collections/…` which 404 — fix; add clip pages; video sitemap — 🤖 · ½ day — done 2026-09-27 (only location + category hubs listed; every clip of a live album listed in both languages with a `<video:video>` block — poster, watermarked preview, duration; new spec `specs/public/sitemap.md`; `verify:seo` fetches every sitemap URL and fails on anything but 200)
- [x] **DEV-35** English pages carry Arabic in share data (`ar_SA`, `inLanguage`, breadcrumbs) — make locale-aware — 🤖 · 2 hrs — done 2026-09-27 (`inLanguage` from the page's locale on WebSite, FAQPage and VideoObject; hub breadcrumbs localised in name and address; `og:locale:alternate` added; `verify:seo` checks both)
- [x] **DEV-36** Structured data: VideoObject `uploadDate` + AI-origin marker; Product image/brand; Organization address/contact; album share image = cover — 🤖 · ½ day — done 2026-09-27 (VideoObject `uploadDate`, absolute thumbnails, IPTC `digitalSourceType` AI/camera marker; Product `image` + `brand` + the same marker; Organization email + ContactPoint from `NEXT_PUBLIC_CONTACT_EMAIL` — email only, owner's choice, address added automatically once set; album share image = chosen cover. **Owner:** set `NEXT_PUBLIC_CONTACT_EMAIL` on the server)
- [x] **DEV-37** Hide private pages from Google in English too (`/en/account`, `/en/studio`, `/en/admin`, `/checkout`, `/boards`); noindex empty hubs — 🤖 · 1 hr — done 2026-09-27 in DEV-33 (robots.txt disallows the private pages under `/en` too, plus checkout and password pages)
- [x] **DEV-38** Missing page descriptions (~10 routes) + natural English hub titles ("Riyadh stock footage") — 🤖 · 2 hrs — done 2026-09-27 (descriptions on /creators, sign-in, sign-up, forgot/reset password, checkout, checkout return, forbidden, shared boards; location/category hubs titled «لقطات الرياض» / "Riyadh stock footage" in title and H1, own-language SEO text only, generated descriptions per kind)
- [x] **DEV-39** ⛔ Page speed: hero film is 31 MB and never cached — lighter encode, long cache headers, phone poster; preload fonts, cache them — 🤖 · 1 day — done 2026-09-27 (film 31 → 13 MB desktop, 12 → 7.5 MB phone, same look; versioned names cached 1 year; `/hero` and `/fonts` immutable; phone poster 27 KB via `<picture>`; 2 fonts preloaded)
- [x] **DEV-40** `SITE_ORIGIN` / `AUTH_URL` set together so links never fall back to localhost — 🤖 · 30 min — done 2026-09-27 (one `siteOrigin()` in `lib/site.ts` for every absolute URL — layout metadataBase, sitemap, robots, JSON-LD, email-verification link no longer read the Host header; mismatch warned; production with neither set throws; `verify:mail` checks it; `.env.example` + README)

### Hub pages and blog
- [ ] **DEV-41** Admin fields to write text for location and category pages; hub shows intro, 3 FAQs, albums first, related hubs — 🤖 · 2 days
- [ ] **DEV-42** Occasions pages `/occasions/[slug]` (Ramadan, Eid, Founding Day, National Day, Riyadh Season) — 🤖 · 1 day
- [ ] **DEV-43** Blog: `/blog`, article page, categories, RSS, sitemap, Article structured data — through Impeccable — 🤖 · 2 days
- [ ] **DEV-44** Blog admin: editor with Arabic preview, drafts, scheduling, SEO fields, "embed album" block — 🤖 · 2 days
- [ ] **DEV-45** Proper waitlist: its own table, consent line, language, source, unsubscribe, export/sync to Resend Audiences — 🤖 · 1–2 days
- [ ] **DEV-46** **Google Analytics** (D10) + UTM tracking, loaded only after consent via a cookie banner; privacy policy updated — 🤖 · ½ day · *needs BIZ-12 (banner decision)*

## M5 — Rehearsal · by 21 Nov

- [x] **DEV-47** ⛔ Production seed with real data only (taxonomy, bands, licence, admin) — no demo albums, fake ratings or view counts — 🤖 · ½ day — done 2026-09-27 (`npm run db:seed:production` with ADMIN_EMAIL/ADMIN_PASSWORD; shared real data in `prisma/seed-base.ts`; demo seed refuses non-local databases; demo seed's missing-licence bug fixed; `verify:production-seed`)
- [ ] **DEV-48** Security: suspended users logged out at once; rate limits on sign-in, sign-up, checkout; Content-Security-Policy — 🤖 · 1 day
- [ ] **DEV-49** Remove or finish half-wired controls: "Add to board" on the clip page; promo codes (wire or hide) — 🤖 · ½ day
- [ ] **DEV-50** Sentry error reporting wired — 🤖 · ½ day · *needs BIZ-08*
- [ ] **DEV-51** Paymob refunds made in the Paymob dashboard reverse Laqta's records — 🤖 · ½ day · *needs BIZ-04*
- [ ] **DEV-52** Privacy features as decided (deletion/export by email or a button) — 🤖 · ½–2 days · *needs BIZ-12*
- [ ] **DEV-53** ⛔ Full rehearsal on the test site: buyer (card + bank transfer, emails, download, licence PDF) and creator (upload → review → live → sale email) — 🤝 · ½ day
- [ ] **DEV-54** Emails land in the inbox (Gmail + Outlook, Arabic + English) — 🤝 · 1 hr
- [ ] **DEV-55** Phone + desktop pass of every page in both languages; landing on a real iPhone — 🤖 · ½ day
- [ ] **DEV-56** Restore a database backup once — 🤝 · 1 hr
- [ ] **DEV-57** Operator daily digest email (queue, unsettled transfers, failed mail, messages) — 🤖 · 1 day

## M6 — Live

- [ ] **DEV-58** ⛔ Production deploy: domain, SSL, production seed, albums loaded — 🤝 · ½ day
- [ ] **DEV-59** Uptime + SSL monitoring — 🤝 · 30 min
- [ ] **DEV-60** First two weeks: daily check of errors, failed emails, zero-result searches — 🤖

## After launch
Price negotiation with creators (decision B) · admin-editable legal pages ·
accounting CSV exports · mada / Tabby / Tamara · HLS streaming ·
e-invoicing via a certified provider · team accounts · English studio ·
studio: edit releases and clip metadata beyond titles.
