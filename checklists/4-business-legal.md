# 4 · Business & legal checklist

Things only you can do: outside companies, money, law, company details.
Many take **weeks of waiting** — start them in M1 even though the answer
arrives later. Key and milestones: [README](README.md).

## M1 — Send everything out · by 3 Oct

- [x] **BIZ-01** ⛔ Create a **private** GitHub repository (Claude pushes the code: DEV-02) — 🧑 · 15 min — done 2026-09-26
- [ ] **BIZ-02** ⛔ Lawyer: review Terms, Privacy, Licences, Content policy (both languages) + questions: copyright in AI-generated footage, trademarked buildings in AI footage, AI disclosure wording, Egypt vs Saudi governing law, consumer-law disclosure vs the "no refund copy" decision — 🧑 · 1 hr + wait
- [ ] **BIZ-03** ⛔ Accountant: `docs/business/tax-questions-for-accountant-ar.md` — VAT on USD sales to Saudi buyers, invoices / e-receipts, invoice currency, credit notes, withholding tax on creator payouts — 🧑 · 1 hr + wait
- [ ] **BIZ-04** ⛔ Paymob: written yes to **USD charges to Saudi cards** (and mada?), **payout currency (USD or EGP) and FX margin**, fees, holds, chargebacks; then the `PAYMOB_*` keys — 🧑 · 1 hr + wait
- [ ] **BIZ-05** ⛔ Domain: `.sa` needs a Saudi registration, so likely `.com`; register in the company name, auto-renew, registrar lock, DNS access — 🧑 · 1 hr
- [ ] **BIZ-06** ⛔ AWS account + billing alarm (Claude walks you through the buckets in DEV-15) — 🧑 · 1 hr
- [ ] **BIZ-07** ⛔ Hosting choice — Claude proposes 2 options with monthly cost, you pick — 🤝 · 1 hr
- [ ] **BIZ-08** Sentry account (free) — 🧑 · 15 min
- [ ] **BIZ-11** ⛔ USD bank account for the company; ask the bank about receiving international wires and sending USD abroad — 🧑 · weeks
- [ ] **BIZ-12** Privacy decisions: account deletion / data export (email or a button), cookie banner, hosting region — 🧑 · 30 min
- [x] Make decisions **D1–D10** in the [README](README.md) — 🧑 · 2 hrs — done 2026-09-26

## M2 — Before creators sign · by 17 Oct

- [ ] **BIZ-09** ⛔ Creator agreement (with the lawyer): rights warranty, AI-origin + AI-tool-terms warranty, non-exclusive licence to Laqta, commission and 30-day hold, price agreed per album, payout method, withholding tax, takedowns, free-sample permission — 🧑 · 1–2 weeks
- [ ] **BIZ-10** Company details for the site: legal name (Arabic/English), Egyptian address, CR number, support email, WhatsApp — 🧑 · 30 min
- [ ] **BIZ-13** Resend: account, add the domain, publish the DNS records, create the API key (put it in `.env` yourself — never paste it in chat) — 🧑 · 1 hr + wait · *needs BIZ-05*
- [ ] **BIZ-14** ⛔ Creator payout rail from Egypt: Payoneer mass payouts (Wise likely won't accept an Egyptian company — check) — 🧑 · 1 week
- [ ] **BIZ-15** Creator tax documents to collect (national ID + tax card for residents, declaration for non-residents) — 🤝 · 2 hrs · *needs BIZ-03*
- [ ] **BIZ-16** Release templates (model / property) in Arabic and English — **needed: D1 allows filmed footage** — 🧑 + lawyer

## M5 — Support and operations · by 21 Nov

- [ ] **BIZ-17** Real mailbox on the domain (`support@`, operator email) — Google Workspace or Zoho; Resend only sends — 🧑 · 2 hrs
- [ ] **BIZ-18** WhatsApp Business: number, profile, greeting and away messages — 🧑 · 2 hrs
- [ ] **BIZ-19** Support hours and reply time (e.g. Sun–Thu, 1 business day) shown on `/contact` — 🧑 decide · 30 min
- [ ] **BIZ-20** Saved replies (Arabic/English): licence scope, AI origin, download help, bank transfer steps, invoice request, "can I buy one clip?", creator applications — 🤖 · 3 hrs
- [ ] **BIZ-21** Bank-transfer rules: settle within 1 business day; who pays international wire fees; order number as the reference — 🧑 · 1 hr
- [ ] **BIZ-22** Agency pack: company documents, bank letter, quote template; PO accepted but payment first — 🧑 · 1 day
- [ ] **BIZ-23** Written daily routine (15 min): orders, transfers, messages, review queue, errors. Weekly and monthly (payout run from January, bookkeeping, AWS bill) — 🤖 · 2 hrs
- [ ] **BIZ-24** Bookkeeping tool and monthly close with the accountant — 🧑 · 2 hrs
- [ ] **BIZ-25** "If I'm away" plan: where passwords and the runbook live (a password manager, not the repo) — 🧑 · 1 hr
- [ ] **BIZ-26** ⛔ One real card purchase with your own card, then refund it; Paymob and Laqta agree — 🧑 · 30 min · *needs BIZ-04, DEV-16*

## Before public launch

- [ ] **BIZ-27** Trademark «لقطة» / Laqta (word + logo): search and file in **Saudi Arabia (SAIP)** first, then Egypt — 🧑 + lawyer
- [ ] **BIZ-28** Creator agreement + release templates signed and stored for every launch album — 🧑
