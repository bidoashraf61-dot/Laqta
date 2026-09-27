# Hub page text

**Route** `/admin/taxonomy/[id]` · **Access** admin (`requireAdmin`) · **Rendering** server component, dynamic

## Purpose
Write the text of one location or category page (DEV-41): what Google and a buyer read above the
albums, in Arabic and English.

## Data in
- `Taxonomy` by id — only `kind` `location` or `category` (anything else → 404): `nameAr`, `slug`, `seoTitleAr/En`, `seoDescAr/En`, `introAr/En`, `faqs` (via `parseHubFaqs`).

## Controls

| Control | Action | Effect |
| --- | --- | --- |
| `BackLink` «التصنيفات والمواقع» | Link | `/admin/taxonomy` |
| «افتح الصفحة» (header, plain `<a target=_blank>`) | — | The public `/locations/[slug]` or `/categories/[slug]` |
| «في نتائج البحث»: العنوان (عربي/إنجليزي, ≤70; empty = «لقطات {name}» automatically), الوصف (عربي/إنجليزي, ≤160) | form fields | `seoTitleAr/En`, `seoDescAr/En` |
| «المقدمة» عربي/إنجليزي (textarea, ≤1500) | form fields | `introAr/En` |
| «أسئلة وأجوبة» ×3 — السؤال/الجواب عربي + إنجليزي | form fields | `faqs` (`hubFaqsFromForm`: empty slots skipped; each kept slot needs the Arabic question AND answer, English both or neither) |
| «حفظ» | `saveHubPage(id)` (`SettingsForm`) | Refuses: not a location/category → «غير موجود»; an incomplete FAQ → «كل سؤال يحتاج جوابه…»; a description over 160 → «الوصف أطول من ١٦٠ حرفاً — جوجل يقصّه.». Writes the seven fields (no FAQs → `NULL`); `AuditLog taxonomy.page` `{faqs: n}`; revalidates both languages of the public page |

## States
- Pre-filled with what is saved. Success/failure inline above the form.

## Invariants
- Only location and category terms have a public page, so only they have this editor.
- The FAQ JSON is only ever written through `hubFaqsFromForm` and read through `parseHubFaqs`.

## Verified by
Unit tests `tests/unit/hub-page.test.ts` (form parsing, refusals, the stored column distrusted, the language fallback). `verify:seo` checks a hub with FAQs carries `FAQPage` JSON-LD (the demo seed writes an intro and two FAQs on `alula`). Not opened by `audit` (needs an id).
