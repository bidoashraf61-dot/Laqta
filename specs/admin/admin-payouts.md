# Payouts

**Route** `/admin/payouts` · **Access** admin only · **Rendering** server, dynamic (`searchParams` + `auth()`)
**Download route** `/admin/payouts/runs/[runId]/[rail]` · admin only (middleware + `requireAdmin` in the handler) · `GET`, `text/csv` attachment, `Cache-Control: no-store`

## Purpose
Work the payout queue for a solo operator: approve a request (freezing the destination
onto the payout), gather every approved payout into a **payout run**, download one file per
rail (bank / Wise / Payoneer) to upload at that rail, and close the run as paid in one step
with the rail's batch reference. A single payout can still be marked paid on its own.

## State machine (lib/payouts.ts)

```
requested ──approve──▶ approved ──create run──▶ processing ──mark run paid──▶ paid
                          │   ▲                     │
                          │   └──────exclude────────┘
                          └───────single mark-paid──────────────────────▶ paid
```

- **A run takes** every payout with `status = approved`, `runId = null` and a non-null
  `destinationSnapshot` (`RUN_ELIGIBLE`). `requested` is never batched: its destination is
  not frozen until approval, and the file must pay the approved account.
- Batched payouts move to `processing` with `runId` set. The creator sees «قيد التنفيذ» on
  `/studio/payouts` from that moment (see the studio spec).
- **Run status**: `draft` (lines can be excluded, files downloadable, can be paid) →
  `paid` (closed with `reference`, `paidAt`, `paidById`) or `void` (every line excluded).
  `exportedAt` is stamped on the first file download.

## Data in
- `searchParams.status` — accepted if in `statusValues('payout')`
  (`requested, approved, processing, paid, failed`); unknown → no filter. Absent →
  `requested, approved, processing`.
- `searchParams.run` — a `PayoutRun.id` among the 20 newest runs to show in the run panel;
  absent or unknown → the newest `draft` run, else the newest run of any status (so a run
  just paid stays in view with its reference), else no run is shown.
- `Payout.findMany` — `orderBy [status asc, createdAt asc]`, `take: 100`, includes
  `creator` (displayNameAr, handle, country) and `run.label`.
- `Payout.groupBy({ by: ['status'] })` — chip counts.
- `Payout.groupBy({ by: ['method'], where: { status in [requested, approved, processing] } })`
  with `_sum.netAmount` and `_count.method` — the per-rail summary tiles (IBAN /
  Payoneer / Wise) and the queued total.
- `Payout.count({ where: RUN_ELIGIBLE })` — how many payouts the next run would take.
- `PayoutRun.findMany` — newest 20, for the history table.
- The selected run with all its payouts (`creator.displayNameAr/handle`), ordered by
  method then `createdAt`. Per-rail counts and totals are summed from those rows'
  `netAmount` in integer cents.

## Layout
1. Header + stat tiles (queued total, one tile per rail).
2. **Run panel** «الدفعة الجارية» — a line saying how many approved payouts are ready, label-first so the number needs no agreement («طلبات معتمدة جاهزة للدفعة القادمة: {count}.»; the create/confirm/paid messages likewise — DEV-22) (or
   that none are), and the create button in the panel header. When a run is selected:
   label (LTR), run status badge, line count · total; **files** — three rail cells, each with
   «البنود» count, net total and «تنزيل الملف» (plain `<a download>`), or «لا تحويلات على هذه القناة»;
   **lines** table — creator, rail + destination hint (`•••• last-4` of the IBAN, or the
   email), net amount, payout status, and the exclude control while `draft`; **pay** block
   (reference field + «تأكيد تحويل الدفعة كاملة») while `draft`, otherwise the closed note with
   the run reference and paid date.
3. The queue (filter chips + table) as before. A `processing` payout inside a run shows
   «ضمن الدفعة <label>» instead of the mark-paid control. An `approved` payout that came back
   from a run shows «أُعيد من دفعة: <reason>» under its status.
4. **Run history** «سجل الدفعات» — label, created, status, lines, net total, reference, and a
   plain `<a>` «عرض» to `?run=<id>` (absent on the row already shown).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `FilterChips` | plain `<a>` to `?status=` | re-queries the queue |
| «اعتماد» (only when `status === 'requested'`) | `approvePayout(payoutId)` | `status='approved'`, `approvedById`, `approvedAt`, and `destinationSnapshot` written from the creator's current payout rail: IBAN → `{iban, bankName, beneficiary}`; Payoneer/Wise → `{email, beneficiary}` where `beneficiary = beneficiaryName ?? displayNameEn`. Audits `payout.approve` |
| Reference input + «تأكيد التحويل» (status `approved`/`processing`, **not in a run**) | `markPayoutPaid(payoutId, reference)` → `lib/payouts#postPayoutPaid` | in one transaction: guarded flip to `paid` (`paidAt`, `reference`), plus one `CreatorLedger` `payout` entry of `−amount`, `memo = reference`, `balanceAfter` = creator's latest entry − amount. Audits `payout.paid` |
| «جمّع المعتمد في دفعة» (panel header, only when something is eligible) | `createRun()` → `createPayoutRun` | one transaction: creates a `draft` run labelled `PR-YYYYMMDD-HHMMSS` (UTC), claims every eligible payout with a guarded `updateMany` (`runId`, `status='processing'`, clears `failureReason`), sets `payoutCount`/`totalAmount` (sum of `netAmount`), `periodStart/End` (oldest/newest `createdAt`), `approvedById/At`. Audits `payout_run.create` |
| «تنزيل الملف» per rail | `GET /admin/payouts/runs/[runId]/[rail]` | builds the CSV (below), stamps `exportedAt` if unset, audits `payout_run.export` with rail and row count. 404 on an unknown rail, missing or `void` run; 403 for a non-admin |
| Reason input + «استبعاد» (per line, `draft` only; browser confirm) | `excludeRunLine(runId, payoutId, reason)` → `excludeFromRun` | one transaction: locks the run (`draft` only), moves the line back to `approved`, `runId = null`, `failureReason = reason`; recomputes the run's count and total; a run left empty becomes `void`. Audits `payout_run.exclude` |
| «مرجع الدفعة» + «تأكيد تحويل الدفعة كاملة» (`draft` only; confirm names count and total) | `payRun(runId, reference)` → `markRunPaid` | one transaction: guarded flip of the run `draft → paid` (`reference`, `paidAt`, `paidById`), then `postPayoutPaid` for every `processing` line — the **same function** as the single mark-paid, with the run reference as each payout's `reference` and ledger `memo`. Audits `payout_run.paid` |
| «عرض» in history | plain `<a>` to `?run=<id>` | shows that run in the panel |

## Export files
All CSV, UTF-8 without BOM, CRLF line endings, amounts as `0.00` from `Payout.netAmount`
(what reaches the creator; withholding stays with Laqta), currency = `Payout.currency`
(`USD` today). Line reference = `LAQTA-` + last 10 chars of the payout id, uppercased.
Nothing else leaves: no gross amount, no creator id, no country, no bank name.
Filename `laqta-<run label>-<rail>.csv`.

| Rail | Header | Columns |
| --- | --- | --- |
| `iban` | yes | `beneficiary_name,iban,amount,currency,reference` — IBAN with spaces removed, uppercased |
| `wise` | yes | `name,recipientEmail,paymentReference,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency` — Wise batch "email recipients" template; `receiverType=PRIVATE`, `amountCurrency=target` (the creator receives the exact amount, fees on Laqta), source = target = payout currency |
| `payoneer` | **no** | A `email`, B `amount`, C `currency`, D `description` (= line reference) — Payoneer batch payment column positions |

Free-text names are CSV-quoted when they contain `,` or `"`, and a leading `= + - @ tab` is
stripped so the file cannot run a formula when opened in a spreadsheet. The name is the
frozen `destinationSnapshot.beneficiary`; payouts approved before this change froze no name
for email rails, so the export falls back to the creator's current `beneficiaryName`, then
`displayNameEn`.

## States
- **Empty queue** — `EmptyState` with `dash.noPayoutRequests`.
- **Nothing eligible** — run panel says «لا طلبات معتمدة بعد…», no create button. The action
  still refuses with `payoutRun.nothingToBatch` if called.
- **No runs yet** — the run panel shows only the ready line; history says «لم تُنشأ أي دفعة بعد».
- **Rail with no lines in the run** — the cell shows «لا تحويلات على هذه القناة», no link.
- **Paid run** — read-only: no exclude, no pay form; files still downloadable for
  reconciliation; closed note with reference and date.
- **Void run** — read-only, no download links, listed in history.
- **Pay with an empty reference** — blocked client-side (toast `payoutRun.referenceRequired`)
  and refused server-side with the same message.
- **Pay a run twice** (double click, second tab, retry) — no-op, toast
  `payoutRun.alreadyPaid`; no ledger rows posted.
- **Exclude on a paid/void run or a line not in it** → `state.error`.
- **`paid` / `failed` payout** — `PayoutControls` renders `null`; the row is read-only.
- **Single mark-paid** on a paid payout, a `requested` payout, or one inside a run →
  `state.error`; on a missing payout → `state.notFound`.
- **Approve on a payout that is not `requested`** → `state.error`.
- **Rail with nothing queued** — the tile renders a zero amount and a zero count.
- **Truncation** — queue `take: 100`, history `take: 20`, no pagination.
- **Loading / error** — no route-level `loading.tsx` or `error.tsx`.

## Invariants
- **One accounting path.** `lib/payouts#postPayoutPaid` is the only code that marks a payout
  paid and posts its ledger row; the single action and the run both call it. It posts one
  `payout` row of `−Payout.amount` (gross — withholding is not posted separately, exactly as
  before runs existed).
- **Amounts come from the payout rows.** Run totals and file amounts are `netAmount`; the
  ledger uses `amount`. Nothing in this area reads a sale or recomputes commission.
- **Idempotent.** Every state change is a guarded `updateMany` whose `where` names the
  expected prior state; a row lock makes a concurrent second submit match nothing.
  A run is paid at most once; a payout is posted at most once.
- **The destination is frozen at approval**, and the files read only `destinationSnapshot`
  (name fallback above aside). An excluded line keeps its snapshot.
- **A payout in a run is paid only with the run** — the files the rail already received and
  the ledger cannot disagree.
- Marking paid writes the payout rows, the run row and the ledger entries in **one
  transaction**.
- `balanceAfter` is computed from the creator's most recent ledger row, not recomputed
  from scratch.

## Not wired
- `Payout.withholdingAmount`, `invoiceKey`, `periodStart/End` are displayed nowhere and set
  nowhere in this area. There is no control to move a payout to `failed`; a bounced line is
  excluded back to `approved` instead.
- A run cannot be edited after creation except by excluding lines; payouts approved later go
  into the next run.
- Files are generated on each download from the rows, not stored — `PayoutRun.exportKeys`
  stays unused.

## Verified by
`verify:payouts` (run eligibility, the three CSV formats and their totals, single vs run
ledger rows, sequential and concurrent double submit, exclusion back to the queue);
`verify:arabic`, `audit`, `verify:flows` (filter-chip navigation on `/admin/payouts`).
The 30-day hold that makes a balance payable is covered by `verify:money`. The rendered
run panel and the download route are not driven by a browser gate.
