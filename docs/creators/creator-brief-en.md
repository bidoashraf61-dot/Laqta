# Laqta — Creator brief and spec sheet

**Draft for owner approval · 2026-09-26 · ALB-20**
Arabic version: [creator-brief-ar.md](creator-brief-ar.md) · QA log template: [qa-log-template.csv](qa-log-template.csv)

Laqta (لقطة) is a stock footage library for Saudi Arabia. Buyers — freelance
editors and agencies — buy whole **albums** with a one-time payment and a
permanent licence. No subscription. This brief is everything you need to
deliver an album that passes review the first time.

---

## 1. The founding-creator offer

| | |
|---|---|
| Your share | **70% of every sale** of your album |
| Price | **$49–$249 per album.** You recommend a price with the calculator in the studio (clip count × resolution × footage type × quality); Laqta approves it or proposes another, and your album is never published at a different price without your agreement |
| Payouts | In USD, once your available balance reaches **$100**. Each sale becomes available **30 days** after purchase |
| Paid to | Bank account (IBAN), Wise or Payoneer — your choice in the studio |
| Rights | Non-exclusive: you keep your copyright and may sell the clips elsewhere |
| Deadline | Album delivered by **[date — owner sets in ALB-23]** |

### How the price is worked out

In the studio's album details you choose footage type, resolution and quality;
the calculator shows a suggested price and the range you can recommend in.

| Factor | Effect on the price |
|---|---|
| Clip count | 30–39 clips $79 · 40–49 $119 · 50–59 $159 · 60–70 $199 (the base) |
| Resolution | 720p ×0.6 · 1080p ×1.0 · 4K ×1.3 |
| Footage type | AI live action ×1.0 · AI 3D animation ×0.9 · AI 2D animation ×0.8 · filmed with a camera ×1.25 |
| Quality (your rating, reviewed by Laqta) | standard ×0.9 · good ×1.0 · exceptional ×1.15 |

Example: 50 clips, 4K, AI live action, good → $159 × 1.3 = **$207**. Always
between $49 and $249.

## 2. What an album is

- **One subject.** One theme, place or activity — e.g. "Jeddah Al-Balad at
  night", "Coffee culture", "Desert and camels". Your topic is agreed with
  Laqta before you start, so albums don't overlap.
- **30 to 70 clips.** The studio will not submit fewer than 30 or more than 70.
- **One origin.** An album is either **all AI-generated** or **all filmed**.
  Never mix the two, and never present AI footage as filmed.
- **One shape.** All landscape 16:9, or — in a dedicated vertical album — all
  vertical 9:16.
- **No filler.** No near-identical repeats to pad the count.

## 3. Technical spec

Every clip in one album must match the others. Mixed frame rates or colour
looks make an album unusable on one timeline — this is the most common reason
we send an album back.

| | Requirement |
|---|---|
| Resolution | **720p, 1080p or 4K** — higher resolution prices higher. Deliver the resolution you actually produced — **no upscaled or soft clips**. One resolution per album |
| Frame rate | **One** per album: 24, 25 or 30 fps |
| Colour | **One** look per album. Rec.709 for AI footage; filmed footage may be LOG or Rec.709 — not both. Keep the grade neutral enough for the buyer to regrade |
| Length | **5–20 seconds** per clip. No 2-second fragments |
| Audio | **None** — mute or remove the audio track |
| File type | `.mov` or `.mp4` |
| Codec | H.264, H.265 (HEVC) or ProRes |
| File size | Up to **20 GB** per file |
| Quality | Sharp, stable, correctly exposed. No dropped frames, blocky compression or flicker |

## 4. Saudi accuracy — what reviewers check

Buyers pay for footage that looks genuinely Saudi. Reviewers reject clips that
get it wrong.

- **Dress:** thobe, ghutra/shemagh and agal worn correctly; abaya and hijab
  styles that match Saudi Arabia, not another country. Modest dress throughout.
- **Places:** architecture, landscape and plants that match the region named
  (Najdi mud-brick is not Hejazi coral-stone).
- **Streets:** traffic drives on the right; Saudi-style number plates; road
  signs in Arabic and English.
- **Text:** any Arabic on screen — signs, shop fronts, packaging — must be
  **correct and readable**, or not there at all. AI tools often invent
  meaningless Arabic letters; those clips are rejected.
- **Conduct:** behaviour appropriate for the Saudi market.

### Extra checks for AI-generated clips

- People must be **fictional**. No likeness of a real person, celebrity or
  public figure.
- Check every clip for AI faults: extra or merged fingers, melting faces,
  objects that morph, impossible physics, flickering backgrounds.
- **Your AI tool's plan must allow you to sell the output commercially as
  stock.** Keep a dated copy of the tool's terms; we may ask for it.
- Record the tool used for each clip in your QA log.

### Extra requirements for filmed clips

- **Model release** for every identifiable face (upload it in the studio).
- **Property release** for private or branded premises.
- **Filming permit** where the site requires one — AlUla (RCU), Diriyah,
  NEOM, Red Sea Global, airports and others. The permit must cover the shoot
  dates and the exact site, and name the issuing authority.

## 5. Not accepted

- The Two Holy Mosques (Makkah and Madinah) — filmed or generated.
- Military, government, border or security facilities.
- Alcohol, gambling, or anything prohibited under Saudi law.
- Religious sites or practices shown disrespectfully; religious or national
  symbols in a commercial setting that demeans them.
- Anything that could read as political or security-sensitive.
- Prominent brand logos, trade dress, or recognisable products as the subject.
  A small, unfocused logo in the background is fine.
- Copyrighted artwork or signage that would need clearance.
- Footage you do not hold full rights to, or lifted from someone else's
  production.
- A clip already on Laqta, or a re-upload of a rejected album.

## 6. File naming

```
<album-short-name>_<number>_<what-it-shows>.mov
jeddah-balad-night_001_lantern-alley-wide.mov
jeddah-balad-night_002_coffee-pour-closeup.mov
```

Lower case, hyphens instead of spaces, three-digit numbers, English letters
only.

## 7. The QA log

Fill in one row per clip in [qa-log-template.csv](qa-log-template.csv) and send
it with your album. It lets the reviewer check your album in one pass instead
of asking you questions.

| Column | What to write |
|---|---|
| file_name | Exactly as uploaded |
| origin | `ai` or `filmed` |
| tool_or_camera | e.g. `Seedance 2.0`, `Kling`, `Sony FX3` |
| location_shown | City / site the clip shows |
| resolution, fps, codec | e.g. `3840x2160`, `25`, `ProRes 422 HQ` |
| duration_s | Clip length in seconds |
| people | `none`, `fictional (ai)`, `unidentifiable`, `identifiable` |
| release_or_permit | Release / permit reference, or `not needed` |
| on_screen_text | `none`, or what the text says |
| self_check | `pass`, or the fault you found |

## 8. How it works

1. **Apply** — send 3–5 sample clips or a portfolio link. We choose creators on
   quality, Saudi accuracy and reliability.
2. **Test** — make **5 clips** on your agreed topic to this spec.
3. **Agree** — sign the creator agreement; your topic and deadline are fixed.
4. **Make the album** — 30–70 clips, QA log filled in.
5. **Upload** — create the album in the Laqta studio (Arabic interface) and
   upload clips and any releases.
6. **Review** — within **3 working days**. Either approved, or returned with
   the reviewer's reasons.
7. **Live** — at the price you agreed. You earn 70% of every sale.

**Questions:** [contact email — owner adds]
