# Glossary — one word per concept

**Cross-cutting; applies to every surface.** Derived from the approved copy
document. When a concept has a word here, that word is the only one used —
in `messages/ar.json`, `messages/en.json`, `content/legal.ts` and any string
built in a component.

## Purpose

Stop the same idea being named two ways on two pages. This is not style
policing: the nav said «صناع المحتوى» and the catalogue said «صنّاع المحتوى»,
and the search box invited people to look for «طائرة بدون طيار» while the
filter rail only offered «درون» — a buyer who reads one and searches the other
finds nothing.

## The terms

| Concept | Arabic | English |
|---|---|---|
| The catalogue's unit | ألبوم / ألبومات | album / albums |
| A single piece of footage | لقطة / لقطات | clip / shot |
| Go to the catalogue | استكشف اللقطات | Explore the footage |
| See every album | تصفح جميع الألبومات | Browse all albums |
| The album's preview film | التريلر / شاهد التريلر | trailer / Watch trailer |
| Who supplies the footage | **صنّاع المحتوى** (with shadda) | creators |
| The commercial grant | ترخيص تجاري كامل | full commercial licence |
| Link to the licence page | تفاصيل الترخيص | License details |
| What you keep after paying | امتلاك دائم للأبد | permanent lifetime ownership |
| How you pay | ادفع مرة واحدة · بلا اشتراكات | pay once · no subscriptions |
| What lands in your library | الجودة الأصلية | original quality |
| Common questions | الأسئلة الشائعة | Frequently asked questions |
| The aircraft | **درون** | drone |
| Footage made with a camera | تصوير واقعي | Real footage |
| Footage made with generative tools | ذكاء اصطناعي | AI generated |
| The album's shape | أفقي / عمودي / أفقي وعمودي | Landscape / Portrait / Landscape & portrait |
| Footer rights line | حقوق النشر محفوظة | Copyright reserved |
| Brand line | خيارك الأول للمحتوى السعودي الأصيل | Your first choice for authentic Saudi content |

## Deliberately NOT adopted from the source document

Two of its claims still contradict what the product does, so the wording is
used but the claim is not. A third was resolved by changing the product:

1. ~~**«ترخيص تجاري كامل» as a single uncapped grant.**~~ **Now adopted — the
   product changed.** The two tiers were collapsed into one full commercial
   licence with no view cap, so the phrase is literally true and the tier names
   no longer exist. See `specs/public/licences.md`.
2. **«30، 50، أو 70 لقطة» as album sizes.** The catalogue runs 12–24 clips per
   album. Sizes are read from `Album.clipCount`, never asserted in copy.
3. **«أرخص بـ 16 مرة من أي منافس».** Unverifiable, and the house rule is that no
   competitor figure ships. Real competitor figures live in
   `docs/website-content.md` §B19 and stay there.

## Invariants

1. A concept in the table above has exactly one word per language, everywhere.
2. Arabic spelling is exact, shadda included — «صنّاع» not «صناع». Two spellings
   are two words to a search index and to a reader.
3. A term used in a filter, a spec table and a placeholder must be the same term
   in all three.
4. Adding a synonym to one page means changing this table, not that page.

## Verified by

`npm run verify:i18n` covers Arabic formatting and folding. The terminology
itself is not yet machine-checked — a stale-term scan lives in this change's
commit message and should become a gate if the vocabulary drifts again.
