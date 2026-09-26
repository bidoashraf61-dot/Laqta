# Album One — decision, shot list, and 12-month calendar

**Status:** Decision doc · 8 August 2026 · plan only, nothing generated
**Decides:** subject of album one, album size, 50-clip shot list, album two, production calendar

---

## 1. The decision

### ⭐ Album one: **«فوق الغيم»** — Saudi Arabia from above the cloud sea

Fifty high-altitude aerial clips. Every clip is one Saudi place standing above, rising
out of, or sinking into an unbroken sunlit cloud deck. Sunrise-to-golden light band
only. No people, no text, no flags, no religious sites, no built interiors.

Locations: الرياض · العلا · الحِجر · الدرعية · جدة · الربع الخالي · حافة العالم ·
البحر الأحمر · عسير · plus aircraft-window POV and pure cloud plates.

### Which criterion I weighted most, and why

**THE MOAT (#3), weighted heaviest — because it is the only criterion the competition
cannot answer.** Everything else on the list is a matter of degree; the moat is binary.

Riyadh does not get a sea of clouds. Qasr al-Farid has never in its two thousand years
stood above a cloud deck. There is no altitude, no permit, no budget, and no weather
window that produces these shots. A competitor with a RED, an Inspire 3, an RCU permit
and a year of waiting still cannot make them. That is the definition of a moat, and it
is the *only* album concept on the table where the answer to "why not just film it?" is
"you can't."

Compare with the alternative readings of the brief. A National Day album competes with
[ArabsStock's national-day category](https://arabsstock.com/ar/videos/category/national-day)
— roughly 100 clips of flags, KAFD drone shots and عرضة نجدية — where our only edge is
price. A business album competes with the entire global stock industry shooting real
offices for real money. In both, we win on price and lose on everything else. Above the
clouds, we are the only supplier in the world.

**The second-heaviest weight was RELIABILITY (#5), and it points the same way.** This
album has zero people, zero hands, zero faces, zero crowds, zero text. The failure
classes that make AI footage embarrassing are designed out of the product rather than
QC'd out of it. Rock, cloud, water and light are the four things these models render
best, and we have fourteen approved 4K stills and eight working Seedance prompts proving
it in exactly this look.

**Coherence (#4) is already solved, not aspirational.** The existing stills share one
grade, one altitude, one lens character, one light direction. The album rule in
`saudi-stock-footage-portal-plan.md` §1 — "an album should cut together without
regrading" — is satisfied by assets that already exist.

**On timing (#1) — the criterion I deliberately did *not* let decide this.** The brief is
right that Saudi National Day is 23 September 2026, roughly six and a half weeks out,
and that the buying window is open now. Two things defuse it:

1. **This album serves the National Day window without being a National Day album.**
   The opening establisher is the single most-used shot in any National Day film, and
   ND96's official identity, launched by the GEA under the slogan **«عزّنا بطبعنا»**,
   is built on pride in Saudi character and land. Landscape *is* this year's brief.
   The album lands in the window, then keeps selling in November, February and June.
2. **A dedicated ND album is already late, and more dangerous than it looks** — see
   §2 below. Six weeks is not enough runway to stand up a people-and-flags pipeline for
   the first time.

**Reuse (#6) confirms it.** An occasion album sells hard for six weeks and sleeps for
ten months. Album one carries the launch; the launch needs a spine, not a firework.

**Search coverage (#7) is unusually strong here** because the clips are location-tagged.
Fifty clips cover nine of the nineteen locations in the taxonomy's primary axis, plus
Aerials, Desert & Nature, Coast & Marine, Heritage & Architecture and Cityscapes on the
subject axis. A visitor searching «الرياض جوي» or «العلا» or «الربع الخالي» finds
something. That is more taxonomy coverage per credit than any other concept considered.

**Bonus: the homepage hero is already the trailer for this album.** The scroll-scrub
cinematic in `landing/` is the same look. A visitor lands, watches it, and the thing
they just fell for is on sale. That conversion path costs nothing extra.

---

## 2. The two runners-up, and why they were rejected

### Runner-up A — «اليوم الوطني ٩٦» · National Day 96

**Rejected. Deferred to June 2027 for ND97 (see §9).**

The timing case is real: 23 September 2026 is 6.5 weeks away and agencies are briefing
now. Three things kill it for album one.

**1. The flag carries the shahada, and text is what these models fail at.** The Saudi
flag is not a colour field — it bears the شهادة in Thuluth, above a sword. Garbled
Arabic script is the single most common and most reliable AI generation failure. A
malformed shahada on the national flag, sold to a Saudi agency, is not a quality
complaint. It is a religious-text error and a flag-desecration issue in a jurisdiction
that legislates on both, and it ends the business. The brief's "no religious sites" rule
was written about buildings; the same risk is hiding inside the most secular-looking
occasion on the calendar. **A National Day album that avoids the flag is not a National
Day album; one that includes it is a bet-the-company risk on an unproven pipeline.**

**2. It is people-heavy in exactly the ways that fail.** What ND edits actually need is
crowds, families, عرضة نجدية, fireworks over spectators, children with flag face paint.
Hands, faces, crowd geometry and fabric-in-motion, all at once.

**3. Even if it worked, it is late and then it sleeps.** Live by ~5 September means the
whole generate-QC-reframe-ingest loop in under four weeks, first time out. Miss it and
the money is gone until September 2027 — the brief's own "dead for a year" scenario.

### Runner-up B — «الأعمال والشركات» · Business & Corporate

**Rejected for album one. Scheduled as album six, January 2027.**

Strong on the criteria that album one is weak on — pure evergreen, sells every month,
the biggest standing demand category in the taxonomy — and it will be a good album. It
loses on two.

**Reliability:** Saudi corporate footage means thobe and ghutra, women in modest
workwear, hands on keyboards, faces in meetings, handshakes across a table. Every one
of those is a high-reject-rate generation, and gender interaction in a meeting room is
precisely the judgement call the `higgsfield-cultural-qc` gate exists for. This is the
right album to learn people on — after there is revenue, not before it.

**Moat:** none. Any competitor can film an office in Riyadh next Tuesday. We would be
selling on price alone in the one category where the global stock libraries are deepest.

---

## 3. Album size and cost

**Recommendation: 50 clips at 10 seconds each.**

Fifty is the number `docs/content/website-content.md` is already written around — «٥٠ لقطة»
appears on the album card, the album page and the clip page — and it lands in the Pro
tier (35–69 clips) in the plan's price table. Ten seconds is what an editor actually
uses; it also matches the existing 10s multi-frame Seedance prompts in `production/hero-film/clip_prompts/`.

### Costed from the measured log, not from list prices

Real billed rates from `~/.claude/skills/higgsfield-pipeline/references/calibrated-costs.md`:

| Tuple | Measured | Tier |
|---|---|---|
| `seedance_2_0` · 1080p · 16:9 · audio-on | **9 credits/second** | MEASURED (5s=45cr, 15s=135cr, both matched billing exactly) |
| `nano_banana_pro` · 4K · i2i, 2–3 refs | **4 credits/image** | LOCKED ANCHOR (6 samples, 0% variance) |
| `reframe` 16:9 → 9:16 | no row | **ESTIMATED** |

| Line | Qty | Rate | Credits | USD |
|---|---|---|---|---|
| Video — 10s clips | 50 | 90 cr | 4,500 | $203 |
| Reject buffer @ **40%** | 20 extra | 90 cr | 1,800 | $81 |
| New 4K stills (35 needed × 3 attempts) | 105 | 4 cr | 420 | $19 |
| 9:16 reframe from 4K master | 50 | ~20 cr *est.* | ~1,000 | ~$45 |
| **Total** | | | **≈ 7,720 cr** | **≈ $348** |

At 8s clips instead: ≈ 6,460 cr ≈ **$291**. I would spend the extra $57 for 10s.

**USD conversion uses the brief's own ratio** ($257 ÷ 5,706 cr = $0.045/credit).

**Three cost notes worth acting on:**

1. **Buffer is 40%, not 50%.** No people, no hands, no text, and eight prompts in this
   exact look already produced usable footage. If the first ten clips run better than
   40%, drop it to 30% and re-plan; if worse, stop and diagnose rather than grinding.
2. **⚠️ Stills cost 4 credits. Video costs 90. Spend on stills.** This is the single
   highest-leverage fact in the log — a still is 4% of a clip. Every clip in this list is
   therefore specified as a **two-image (start + end frame) clip**, per the brief's own
   hard-won rule that start and end frames lock and middles drift. Generating three
   candidate stills per frame and picking the best costs 12 credits and removes most of
   the reason a 90-credit render fails. Do not economise here.
3. **Reframe is the only unmeasured line.** Measure it on clip one before committing the
   batch, then log it. If it turns out expensive, 9:16 delivery is the lever to re-plan,
   not the clip count.

### Two spec inconsistencies to resolve before the album page ships

- `docs/content/website-content.md` B6 states «المدة الإجمالية | ١٢ دقيقة». Fifty 10s clips is
  **8 minutes 20 seconds**. Update the copy to «٨ دقائق» or change the clip length.
- Confirm `seedance_2_0` offers a 10s duration in the live catalogue — the cost log has
  measured 5s and 15s rows only. If 10s is unavailable, use 8s and re-cost at $291.

---

## 4. Cultural and legal risk note

**No shot in this album contains a person, a face, a hand, a crowd, a flag, a word of
text, or a religious building.** The entire people-risk class is designed out of the
product. That is deliberate and it is most of the reason this concept won.

The remaining risks and their controls:

| # | Risk | Control |
|---|---|---|
| 1 | **Religious sites** | `production/hero-film/stills/final_stills_4K/04-makkah-NIGHT-4K.png`, `production/references/06-makkah/` (8 files) and `production/references/07-madinah/` (7 files) are **quarantined**. Never a start frame, end frame, or reference image. Move them out of the working set before generation so they cannot be picked up by accident. |
| 2 | **Hallucinated religious architecture** | Explicit negatives on every prompt: no minaret, no dome, no clock tower, no mosque, no Kaaba, no Haram. The Makkah Royal Clock Tower is instantly recognisable and sits over the Haram — ban it by name. |
| 3 | **⚠️ Hallucinated flag** | Explicit negative: `no flag, no banner, no Arabic script, no calligraphy`. Any clip in which anything reads as a flag or as script is **rejected outright, not fixed**. The Saudi flag bears the shahada; a malformed one is not a defect, it is an offence. |
| 4 | **Text and signage** | Riyadh and Jeddah tower clusters will attract hallucinated signage. All shots are high-altitude and back-lit so signage is sub-resolution. Prompt negatives: `no text, no letters, no logos, no signage, no watermark` — already present in the existing prompt grammar; keep it. |
| 5 | **الحِجر / Qasr al-Farid** | Not a religious site — a Nabataean tomb, UNESCO-listed and marketed globally by RCU. Note only: it carries a قوم ثمود folk association some conservative Saudi buyers avoid. Acceptable to include; keep the framing archaeological. Use the modern name **«الحِجر»**, not «مدائن صالح», in all metadata. |
| 6 | **Identifiable trademarked buildings** ⚠️ | Kingdom Centre, Al Faisaliah, KAFD, Jeddah's waterfront towers and At-Turaif are identifiable property. §2 of the plan builds a property-release gate for filmed content; AI generation does not exempt us from architectural and trademark rights. **Control:** cities are rendered as recognisable *clusters and silhouettes*, never a single trademarked tower as the sole hero of a clip; the Kingdom Centre's inverted-arch aperture is deliberately not the subject of any shot in this list. **Raise this with the IP lawyer before launch** — it is the one open legal item this album creates, and it is not on the plan's current list. |
| 7 | **Backstop** | Per project rule, run `higgsfield-cultural-qc` (region `SA`) on **every** shot regardless. A people-free album should pass trivially; if a shot doesn't, that is the signal something was hallucinated into frame. |

---

## 5. Asset reuse — what exists, what is new

### Reused as-is — 9 approved 4K stills (18% of the still pool, 0 credits)

| ID | File | Role |
|---|---|---|
| `A1` | `production/hero-film/stills/final_stills_4K/06-alula-4K.png` | AlUla · Elephant Rock |
| `H1` | `production/hero-film/stills/final_stills_4K/07-qasr-al-farid-4K.png` | الحِجر · Qasr al-Farid |
| `Q1` | `production/hero-film/stills/final_stills_4K/08-empty-quarter-4K.png` | الربع الخالي |
| `E1` | `production/hero-film/stills/final_stills_4K/09-edge-of-the-world-4K.png` | حافة العالم |
| `S1` | `production/hero-film/stills/final_stills_4K/10-red-sea-4K.png` | البحر الأحمر |
| `J1` | `production/hero-film/stills/final_stills_4K/11-jeddah-4K.png` | جدة |
| `D1` | `production/hero-film/stills/final_stills_4K/12-diriyah-4K.png` | الدرعية |
| `W1` | `production/hero-film/stills/final_stills_4K/13-window-MORNING-4K.png` | Aircraft window |
| `C1` | `production/hero-film/stills/final_stills_4K/05-cloud-DAWN-4K.png` | Dawn cloud plate |

### Not reused, and why

`00-window-NIGHT`, `01-pushed-through-NIGHT`, `02-cloud-NIGHT`, `03-riyadh-NIGHT` — all
four are **night**. This album is a single golden/sunrise grade; a night clip would
break the "cuts together without regrading" rule. They are held for a possible night
companion album. `04-makkah-NIGHT` is quarantined (§4).

**Consequence:** Riyadh — the most-searched Saudi location — has no golden still. Five
new Riyadh stills are the first thing to generate.

### New stills needed — 35

| Set | IDs | Place | Reference folder |
|---|---|---|---|
| Riyadh | `R1`–`R5` | Riyadh tower cluster above cloud, golden | `production/references/10-riyadh/` (7 files) |
| AlUla | `A2`–`A4` | Elephant Rock, new angles | `production/references/01-alula/` (5 files) |
| Hegra | `H2`–`H4` | Qasr al-Farid, new angles | `production/references/11-qasr-al-farid/` (2 files) |
| Diriyah | `D2`–`D4` | At-Turaif mud-brick mass | `production/references/08-diriyah/` (4 files) |
| Jeddah | `J2`–`J4` | Waterfront cluster | `production/references/09-jeddah/` (1 file) |
| Empty Quarter | `Q2`–`Q4` | Dune crests, salt pan | `production/references/02-empty-quarter/` (1 file) |
| Edge of the World | `E2`–`E4` | Escarpment, new angles | `production/references/03-edge-of-the-world/` (4 files) |
| Red Sea | `S2`–`S4` | Reef, sandbar, atoll ring | `production/references/05-red-sea/` (3 files) |
| Asir / Sarawat | `V1`–`V4` | Green terraced peaks above fog | `production/references/04-asir-albaha/` (2 files) |
| Window | `W2`–`W3` | Wing, cabin edge | `production/references/00-plane-window/` is **empty** — build refs first |
| Cloud plates | `C2`–`C4` | Pure cloud, no landform | none needed |

**Use the `leera` skill to write every new still prompt.** Feed it the reference folder,
`A1`/`H1`/`Q1` etc. as the look anchor, and the Style & Mood paragraph from
`production/hero-film/clip_prompts/clip07-SEEDANCE-alula-to-qasr-al-farid.txt` — that paragraph is the album's
grade, written down and already proven. Keep it byte-identical across all 35 prompts.

**Asir is the one place with no anchor still.** It is also the only location in the album
where a cloud sea is *real* (the Sarawat fog belt), which makes it the easiest to get
right and the most useful for winter/Soudah campaigns. Generate `V1` first and judge it
before committing the other three.

---

## 6. The shot list — 50 clips

### Conventions

**Camera move vocabulary** — fixed, so the album cuts together:

| Code | Move |
|---|---|
| `M1` | Slow push-in |
| `M2` | Slow pull-back reveal |
| `M3` | Lateral orbit / arc around subject |
| `M4` | Rise reveal — camera climbs out of cloud, subject uncovers |
| `M5` | Descend — camera sinks, cloud closes over frame |
| `M6` | Drift-past with heavy parallax |
| `M7` | Locked plate — camera static, cloud only |
| `M8` | Bank-and-turn onto a new axis |

**Time-of-day bands** — all three grade together; no regrade needed:
`A` first light (cool cloud, amber horizon line) · `B` sunrise (low warm rake) ·
`C` golden morning (full warm)

**Frames** — `start → end` are the two locked images. `M7` plates are single-image
(nothing to drift but cloud); everything else is a two-image clip.

---

### الرياض · Riyadh — 8 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 01 | Riyadh tower cluster standing above unbroken cloud sea, wide | `M1` | B | `R1 → R2` |
| 02 | Riyadh cluster, arc right, towers separating in parallax | `M3` | C | `R2 → R3` |
| 03 | Riyadh uncovers as camera climbs out of the deck | `M4` | B | `C2 → R1` |
| 04 | Riyadh recedes, cloud closing across foreground | `M2` | C | `R3 → R4` |
| 05 | Close drift past a single spire, cloud streaming below | `M6` | C | `R4 → R5` |
| 06 | Riyadh sinks behind vapour as camera descends | `M5` | B | `R2 → C2` |
| 07 | Riyadh locked wide, only cloud moves — **title plate** | `M7` | A | `R1` |
| 08 | Bank-and-turn onto the cluster from the far axis | `M8` | C | `R5 → R2` |

### العلا · AlUla — Elephant Rock — 4 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 09 | Elephant Rock above the deck, light through the arch | `M1` | B | `A1 → A2` |
| 10 | Orbit around the arch, opening closing and reopening | `M3` | C | `A2 → A3` |
| 11 | Rock uncovers from below as camera rises | `M4` | B | `C1 → A1` |
| 12 | Slow pull-back, rock reduces to a mark on the cloud field | `M2` | C | `A3 → A4` |

### الحِجر · Hegra — Qasr al-Farid — 4 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 13 | Carved tomb facade above cloud, raking light on the cornice | `M1` | B | `H1 → H2` |
| 14 | Lateral drift past the facade, pilasters in parallax | `M6` | C | `H2 → H3` |
| 15 | Facade uncovers as vapour peels away — occlusion reveal | `M4` | B | `C1 → H1` |
| 16 | Locked on the facade, cloud only — **title plate** | `M7` | C | `H1` |

*(Prompt for 13–16 inherits the geometry lock from `clip07-SEEDANCE-alula-to-qasr-al-farid.txt`
— "straight verticals on the facade, correct perspective, never bending" — the carving is
the single most warp-prone subject in the album.)*

### الدرعية · Diriyah — 5 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 17 | At-Turaif mud-brick mass above cloud, wide | `M1` | C | `D1 → D2` |
| 18 | Arc around the walls, towers and palms separating | `M3` | C | `D2 → D3` |
| 19 | Rise reveal out of the deck onto the mud walls | `M4` | B | `C3 → D1` |
| 20 | Pull-back, the settlement becoming an island | `M2` | C | `D3 → D4` |
| 21 | Locked wide on At-Turaif, cloud only — **title plate** | `M7` | B | `D1` |

### جدة · Jeddah — 5 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 22 | Jeddah waterfront cluster above cloud, sea glint beyond | `M1` | C | `J1 → J2` |
| 23 | Bank-and-turn along the coastline through the deck | `M8` | C | `J2 → J3` |
| 24 | Descend, city sinking into vapour | `M5` | B | `J1 → C2` |
| 25 | Drift past the tallest cluster, heavy parallax | `M6` | C | `J3 → J4` |
| 26 | Pull-back, coast and cloud reading as one horizon | `M2` | B | `J4 → J1` |

### الربع الخالي · Rub' al Khali — 5 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 27 | Dune crests and turquoise salt pan breaking the deck | `M1` | B | `Q1 → Q2` |
| 28 | Long lateral drift along a dune ridge above cloud | `M6` | C | `Q2 → Q3` |
| 29 | Rise reveal, the pan uncovering below | `M4` | B | `C1 → Q1` |
| 30 | Orbit around an isolated crest island | `M3` | C | `Q3 → Q4` |
| 31 | Locked on the salt pan, cloud only — **title plate** | `M7` | C | `Q1` |

### حافة العالم · Edge of the World — 4 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 32 | Escarpment table standing clear of the deck, wide | `M1` | B | `E1 → E2` |
| 33 | Arc around the cliff face, strata raking past | `M3` | C | `E2 → E3` |
| 34 | Descend along the cliff wall into vapour | `M5` | C | `E3 → C2` |
| 35 | Pull-back, escarpment shrinking on the cloud field | `M2` | B | `E1 → E4` |

### البحر الأحمر · Red Sea — 5 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 36 | Reef ring and sandbar in a break in the deck | `M1` | C | `S1 → S2` |
| 37 | Drift across the atoll, sun glitter tracking the water | `M6` | C | `S2 → S3` |
| 38 | Rise reveal, turquoise opening below the cloud | `M4` | B | `C1 → S1` |
| 39 | Orbit around the sandbar, water colour banding shifting | `M3` | C | `S3 → S4` |
| 40 | Locked on the reef, cloud only — **title plate** | `M7` | B | `S1` |

### عسير والسروات · Asir & the Sarawat — 4 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 41 | Green terraced peaks piercing a real fog sea, wide | `M1` | B | `V1 → V2` |
| 42 | Drift between two peaks, fog pouring through the saddle | `M6` | C | `V2 → V3` |
| 43 | Rise reveal, terraces uncovering out of the fog | `M4` | A | `C3 → V1` |
| 44 | Pull-back, ridge line receding into cloud layers | `M2` | C | `V3 → V4` |

### نافذة الطائرة · Aircraft window POV — 3 clips

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 45 | Wing over an unbroken cloud deck, warm horizon beyond | `M7` | C | `W1` |
| 46 | Window frame, cloud passing, light sweeping the cabin edge | `M6` | B | `W1 → W2` |
| 47 | Slow bank seen through the window, horizon tilting | `M8` | C | `W2 → W3` |

*(No people, no hands, no seat-backs, no tray tables — cabin interior stays out of frame.)*

### غيم خالص · Pure cloud plates — 3 clips *(utility / backgrounds / lower-thirds)*

| # | Subject | Move | ToD | Frames |
|---|---|---|---|---|
| 48 | Cloud deck, no landform, slow forward travel | `M1` | C | `C1 → C2` |
| 49 | Cloud interior, vapour filling frame edge to edge | `M5` | B | `C2 → C3` |
| 50 | Cloud field, locked, slow internal drift — **loop plate** | `M7` | A | `C4` |

*(48–50 are the transition and background stock of the album, and the cheapest shots to
regenerate. They also double as the cloud-crossing element in shots 03, 06, 15, 24, 29,
34 and 38 — generate them first, judge them hardest.)*

---

## 7. Production order

1. **`V1` first** (Asir, no anchor exists) and **`R1` second** (Riyadh golden, no anchor
   exists). These are the two places the album cannot ship without and has no proven
   still for. Judge both before generating the other 33 stills.
2. **Clips 48–50** (cloud plates) next — cheapest, and they validate the grade.
3. **Clip 07** (`M7` Riyadh title plate) — validates the single-image plate technique. If
   an `M7` plate comes back dead-static or drifting, switch all eight plates to two-image
   with a cloud-state variant, and re-cost (+8 stills, 32 credits).
4. **Clip 13** (Qasr al-Farid) — the warp-prone one. If the carving holds geometry, the
   whole album will.
5. Measure and log the **reframe** cost on clip one before batching the other 49.
6. Then the remaining 45 in location blocks, running `higgsfield-cultural-qc` per shot.

**Do not write "drone" in any prompt** — it puts a drone in frame. The existing prompts
say "THE CAMERA IS a high-speed FPV racing drone" and get away with it *because* they
also carry `no drone body, no propellers, no aircraft`. For this album, prefer plain
"the camera" plus the same negatives; these are slower, more composed moves than the
hero film and do not need the FPV framing.

---

## 8. Album metadata — Arabic, Saudi register

### Title

> # فوق الغيم

**Subtitle / descriptor:** `٥٠ لقطة جوية للسعودية`

### Description

> ٥٠ لقطة جوية للسعودية من فوق طبقة الغيم.
>
> الرياض · العلا · الحِجر · الدرعية · جدة · الربع الخالي · حافة العالم · البحر الأحمر · عسير.
>
> كلها بنفس الإضاءة ونفس التدرّج اللوني ونفس المواصفات. تحطها على التايم لاين وتشتغل من
> أول مرة، بلا إعادة تدرّج ولا محاولة توفيق.
>
> ١٠ ثوانٍ للقطة · ١٠٨٠p · أفقي ١٦:٩ ورأسي ٩:١٦ · ٢٤ إطاراً/ثانية.
>
> **٢٫٦٠ دولار للقطة.**
>
> هذي لقطات ما تنصوّر. ما فيه بحر غيم فوق الحِجر، ولا طيران فوق الرياض على هذا الارتفاع.
> مولّدة بالذكاء الاصطناعي — وهذا بالضبط سبب السعر.
>
> ما فيها أشخاص ولا نصوص ولا شعارات. لقطة نظيفة تحط عليها شعارك وخطك اللي تبيه.

### Voice check against `docs/content/brand-voice-ar.md`

✅ Saudi register throughout — `تقدر` · `ما فيه` · `هذي` · `تبيه` · `تنصوّر` · `بلا`
✅ No Egyptian forms · ✅ No corporate Arabic · ✅ No hedging
✅ The number, not a metaphor — «٢٫٦٠ دولار» stated flat and then stopped
✅ AI disclosed before anyone asks, and used as the reason for the price (USP 8)
✅ **No desert clichés** — no رمال ذهبية, no سحر الصحراء, no إرث الأجداد
✅ Hits USP 3 (cuts together), USP 4 (no permits), USP 6 (both orientations), USP 8 (AI)
✅ Last line turns "no people" from an absence into a feature — clean plates for titling

**Taxonomy tags:** `جوية` `الرياض` `العلا` `الحِجر` `الدرعية` `جدة` `الربع الخالي`
`حافة العالم` `البحر الأحمر` `عسير` `صحراء وطبيعة` `تراث وعمارة` `أفق المدينة`
`ساحل وبحار` `شروق` `ذهبية` `لقطة افتتاحية` `خلفية`

---

## 9. Album two — **«ليل المدن»**

**Subject:** Saudi cities from sunset to midnight. Riyadh, Jeddah, Khobar. Blue hour
into full night — glass towers, sodium and LED, traffic light trails, empty plazas,
water reflections. Street to mid-altitude. **No people. No flags. No signage in focus.**

**Size:** 50 clips, same spec, same $348 order of magnitude.

### Why this pair does not overlap

| Axis | Album 1 «فوق الغيم» | Album 2 «ليل المدن» |
|---|---|---|
| Altitude | High — above the cloud deck | Street to mid-rise |
| Light | Sunrise → golden morning | Blue hour → night |
| Grade | Warm amber / cool blue cloud shadow | Cool cyan / warm sodium |
| Subject | Land, rock, water, remote places | Built environment, glass, light |
| Taxonomy | Desert & Nature, Coast, Heritage, Aerials | Cityscapes, Transport & Infrastructure, Business |
| Moat | Unfilmable | Filmable but expensive at scale — night permits, road closures, empty plazas |
| Sells | All year, opens any film | All year, closes any film |

Together they give a buyer the **open and the close** of almost any Saudi corporate,
tourism or National Day film — which is precisely the pair an agency needs before it
trusts a new library with a real brief. Neither is dated; both land inside the ND96
window without carrying ND96's risk.

**Its own risk note:** night city shots are the one place Arabic signage will hallucinate.
Mitigation: long-lens compression, shoot away from facades, keep signage sub-resolution
and out of focus, and reject any clip with anything that reads as glyphs. Same rule as
album one — reject, do not retouch.

**Timing:** produce September 2026, live ~1 October. It catches the ND96 tail and the
Riyadh Season briefing period, then sells every month.

---

## 10. Twelve-month album calendar

**Rule:** an album must be **live 6–8 weeks before** its occasion, because agencies buy
then. Production takes ~3 weeks plus ~1 week ingest and QC, so work starts **10–12 weeks**
before the occasion.

**Dates verified 8 August 2026** — all Hijri-derived dates are Umm al-Qura projections and
must be re-confirmed against the moon sighting closer to the time.

| Produce | Album | Live by | Serves | Occasion date |
|---|---|---|---|---|
| **Aug 2026** | ⭐ **1 · فوق الغيم** — aerials, evergreen | 5 Sep 2026 | National Day 96 establishers **+ all year** | ND96: **Wed 23 Sep 2026** |
| **Sep 2026** | **2 · ليل المدن** — urban night, evergreen | 1 Oct 2026 | ND tail, Riyadh Season briefs **+ all year** | Riyadh Season opens ~Oct |
| **Oct 2026** | ⭐ **3 · رمضان** — table, lantern, night street | **21 Dec 2026** | Ramadan 1448 — the year's biggest window | **~Mon 8 Feb 2027** |
| **Nov 2026** | **4 · يوم التأسيس** — Najdi heritage, mud walls, palms | 4 Jan 2027 | Founding Day | **Mon 22 Feb 2027** |
| **Dec 2026** | **5 · عيد الفطر** — gifting, gathering, sweets | 25 Jan 2027 | Eid al-Fitr | **~Tue 9 Mar 2027** |
| **Jan 2027** | **6 · الأعمال والشركات** — offices, meetings, evergreen | 20 Feb 2027 | All year — the post-crunch evergreen | — |
| **Feb 2027** | **7 · عيد الأضحى** — family, generosity, gathering | 29 Mar 2027 | Eid al-Adha | **~Mon 17 May 2027** |
| **Mar 2027** | **8 · الصيف والسفر** — coast, travel, escape | 26 Apr 2027 | Saudi summer & travel season | Jun–Aug 2027 |
| **Apr 2027** | **9 · خلفيات ومؤثرات** — abstract, loops, transitions | 20 May 2027 | All year — presentations, lower-thirds | — |
| **May 2027** | **10 · العودة للمدارس** | 26 Jun 2027 | Back to school | ~mid-Aug 2027 |
| **Jun–Jul 2027** | ⭐ **11 · اليوم الوطني ٩٧** — flags, crowds, عرضة | **5 Aug 2027** | National Day 97 — done properly | **Thu 23 Sep 2027** |
| **Jul 2027** | **12 · موسم الرياض والفعاليات** | 25 Aug 2027 | Riyadh Season 2027 | opens ~Oct 2027 |

### Three things this calendar is telling you

**1. ⚠️ November–December 2026 is triple-booked.** Ramadan 1448 (~8 Feb), Founding Day
(22 Feb) and Eid al-Fitr (~9 Mar) all fall inside five weeks, so all three albums must be
live between 21 December and 25 January. **Start the Ramadan album in October, not
November.** Note also that Founding Day 2027 falls *inside* Ramadan — Founding Day
creative that year will read as Ramadan-adjacent, and the album should be graded to sit
beside the Ramadan album rather than against it.

**2. National Day is deliberately parked at month eleven.** By June 2027 there will be
four people-containing albums behind us (business, Ramadan, both Eids), a measured
reject rate for faces and crowds, and a cultural-QC gate with a track record. That is
when to take on flags and عرضة — not in the next six weeks with no people pipeline at
all. The cost of waiting is one September; the cost of getting the shahada wrong is the
company.

**3. Two evergreen albums sit at months six and nine on purpose.** Occasion albums sleep
for ten months. Albums 1, 2, 6 and 9 are the four that pay the bills between windows,
and they are spaced so there is never more than a four-month run of purely seasonal work.

---

## Sources

- [Saudi National Day 2026 — Wednesday 23 September](https://festivals.day/en/festival/national-day-saudi/)
- [SPA — GEA launches the National Day identity under «عزّنا بطبعنا»](https://www.spa.gov.sa/N2642350)
- [National Day 96 identity — slogan, values, downloads](https://www.balaconah.com/coverage/Saudi-National-Day-identity-96)
- [Ramadan 1448 begins in Saudi Arabia — ~8 February 2027](https://www.timeanddate.com/holidays/saudi-arabia/ramadan-begins)
- [ArabsStock — Saudi National Day video category (competitor scan, ~100 clips)](https://arabsstock.com/ar/videos/category/national-day)
