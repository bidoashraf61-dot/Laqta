# Laqta hero cinematic — run sheet (Seedance 2.0, 4K)

**Where:** https://higgsfield.ai/seedance-4k — free 4K window

**Settings for every clip. Identical, no exceptions:**

| Setting | Value |
|---|---|
| Model | Seedance 2.0 |
| Duration | **10s** |
| Resolution | **4K** |
| Ratio | 16:9 |
| Sound | **OFF** ⚠️ defaults to On |
| Bitrate | High |

**How to load each clip:**
1. Attach photo 1 → becomes `image 1` = the start frame
2. Attach photo 2 → becomes `image 2` = the middle frame
3. Attach photo 3 → becomes `image 3` = the end frame
4. Paste the whole prompt file, including the header lines at the top
5. Turn sound OFF
6. Generate

⚠️ **Order matters.** The photos are read in the order you attach them.

---

## The 14 stills — running order

All in `production/hero-film/stills/final_stills_4K/`.

| # | File | |
|---|---|---|
| 00 | `00-window-NIGHT-4K.png` | airplane window, night |
| 01 | `01-pushed-through-NIGHT-4K.png` | out through the glass |
| 02 | `02-cloud-NIGHT-4K.png` | inside night cloud |
| 03 | `03-riyadh-NIGHT-4K.png` | Riyadh tower |
| 04 | `04-makkah-NIGHT-4K.png` | Makkah |
| 05 | `05-cloud-DAWN-4K.png` | ★ dawn breaks inside the cloud |
| 06 | `06-alula-4K.png` | AlUla — Elephant Rock |
| 07 | `07-qasr-al-farid-4K.png` | Qasr al-Farid |
| 08 | `08-empty-quarter-4K.png` | Empty Quarter |
| 09 | `09-edge-of-the-world-4K.png` | Edge of the World |
| 10 | `10-red-sea-4K.png` | Red Sea |
| 11 | `11-jeddah-4K.png` | Jeddah |
| 12 | `12-diriyah-4K.png` | Diriyah |
| 13 | `13-window-MORNING-4K.png` | airplane window, morning |

**The arc:** night flight → two night cities → dawn hidden in cloud → five morning landmarks → the coast → the city → the heritage town → back in the plane, morning.

---

## The 7 clips

| Clip | Photo 1 | Photo 2 | Photo 3 | Length | Prompt |
|---|---|---|---|---|---|
| A | 00 window NIGHT | 01 pushed through | 02 night cloud | 10s | to write |
| B | 02 night cloud | 03 Riyadh | 04 Makkah | 10s | to write |
| **C** | 04 Makkah | — | 05 dawn cloud | **8s** | ✅ `clip05-SEEDANCE-makkah-to-dawn.txt` |
| D | 05 dawn cloud | 06 AlUla | 07 Qasr al-Farid | 10s | ✅ `clipB-SEEDANCE-dawn-alula-qasr-10s.txt` |
| E | 07 Qasr al-Farid | 08 Empty Quarter | 09 Edge of the World | 10s | to write |
| F | 09 Edge of the World | 10 Red Sea | 11 Jeddah | 10s | to write |
| G | 11 Jeddah | 12 Diriyah | 13 window MORNING | 10s | to write |

**Total: 6 × 10s + 1 × 8s = 68 seconds.**

### Why clip C is only two photos

The night→morning change happens inside that shot, while the frame is completely full of cloud. It needs the whole shot to itself — putting a third landmark in would give the eye something to compare against and expose the time jump.

---

## Suggested order to run them

1. **Clip C first.** It's the one that could fail. Judge it before doing the rest.
2. Then **D** — already written, and it proves whether the middle photo holds its framing.
3. Then **A, B** — the night opening.
4. Then **E, F, G** — the morning run to the ending.

---

## Notes

**Clip 4 from the old plan (Riyadh → Makkah, 8s) is already rendered** and sits in `production/hero-film/clips_v1/`. It's superseded by clip B above, which covers the same ground at 10s with the night cloud added in front. Keep the old file as a backup until clip B is approved.

**Clips A and G are bookends** — out through the window at the start, back in through it at the end.

**If a clip comes back wrong, re-run only that one.** Every clip is locked to a fixed start and end photo, so a bad clip can't damage its neighbours.

---

## Every prompt carries the same four locks

1. **Frame lock** — first and last frame stated explicitly and described in words, not just attached as images.
2. **Frozen subjects** — buildings, rock and water declared completely static, "like a still photograph". This is what stopped the flashing-lights problem.
3. **Occlusion reveal** — the landmark is *already there* behind the vapour, uncovered as cloud moves aside. Never fades or dissolves in.
4. **Rigid geometry** — correct proportion and perspective even at speed; scale changes only because the camera approaches.

**Note on the middle photo:** the first and last frames lock hard. The middle one is a waypoint, not a lock — expect it to be approximately right rather than exact.

---

## After all 7 are rendered

1. Download every clip
2. Strip audio and encode for scroll-scrubbing:
   ```
   ffmpeg -i in.mp4 -an -c:v libx264 -preset slow -crf 20 -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4
   ```
3. Wire into `landing/` — the scrub engine already supports the chain
4. QA every seam — compare the last frame of each clip against the first frame of the next

---

## Superseded files

`production/hero-film/stills/final_stills_4K/_superseded/` holds the previous AlUla still and an alternate take. Nothing was deleted.

The ten single-join 8-second prompts in `production/hero-film/clip_prompts/` (`clip01`…`clip11`) are from the earlier one-join-per-clip plan. They still work if you ever want to render a join on its own, but the seven clips above are the current film.
