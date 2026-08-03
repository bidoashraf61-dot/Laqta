# Hero Cinematic — Clip Run Sheet

**Model:** `kling3_0` (NOT Turbo — Turbo has no end-frame) · mode `pro` · sound `off` · duration `5` · aspect `16:9`
**Cost:** ~17.5 credits per clip → **~193 credits for all 11**
**Prompt limit:** 2,500 characters (all prompts below verified under)

## Frame IDs — Higgsfield job IDs, usable directly as media values

| # | Still | Job ID |
|---|---|---|
| 00 | window NIGHT | `9362505d-9b4b-4a7e-8c89-4222d232ae91` |
| 01 | pushed through | `0e08c3cf-ae3e-4d7c-9981-1b9011c21c18` |
| 02 | night cloud | `2b65c840-195b-4ab3-842f-b0dd34ee4a26` |
| 03 | Riyadh NIGHT | `a7cf8681-1ebf-41b2-8ae3-f5f9b7fe3443` |
| 04 | Makkah NIGHT | `137b04ff-bd90-411f-a5db-940979e5af1d` |
| 05 | dawn cloud | `05b4c071-bbd2-466c-8fa5-ac5043ec7b6e` |
| 06 | AlUla | `9aa27542-ab9e-44b4-a389-4ad3f5c91382` |
| 07 | Qasr al-Farid | `23fc6d0c-223c-4f88-814e-b8d6dd0e4010` |
| 08 | Empty Quarter | `f0af9bb2-2886-42bd-b45e-f75f2dd92917` |
| 09 | Edge of the World | `6b2425ed-42e4-438b-996e-4a7ffbd26bc0` |
| 10 | Red Sea | `c819e04a-004b-46b1-a26d-c8f5e62ee7ec` |
| 11 | window MORNING | `f1b55008-1fcd-4187-bd62-e56cb8648e42` |

## The 11 clips

| Clip | From → To | start_image | end_image | Prompt file |
|---|---|---|---|---|
| 1 | window → pushed through | 00 | 01 | *(in chat)* |
| 2 | pushed → night cloud | 01 | 02 | `clip02-pushed-to-cloud.txt` |
| 3 | night cloud → Riyadh | 02 | 03 | `clip03-cloud-to-riyadh.txt` |
| 4 | Riyadh → Makkah | 03 | 04 | `clip04-riyadh-to-makkah.txt` |
| **5** | **Makkah → dawn cloud** ★ | 04 | 05 | `clip05-makkah-to-dawn.txt` |
| 6 | dawn cloud → AlUla | 05 | 06 | `clip06-dawn-to-alula.txt` |
| 7 | AlUla → Qasr al-Farid | 06 | 07 | `clip07-alula-to-qasr.txt` |
| 8 | Qasr → Empty Quarter | 07 | 08 | `clip08-qasr-to-empty-quarter.txt` |
| 9 | Empty Quarter → Edge | 08 | 09 | `clip09-empty-quarter-to-edge.txt` |
| 10 | Edge → Red Sea | 09 | 10 | `clip10-edge-to-red-sea.txt` |
| 11 | Red Sea → window MORNING | 10 | 11 | `clip11-red-sea-to-window.txt` |

★ **Clip 5 is the critical one** — the only shot where light changes mid-clip (night → dawn, hidden inside cloud). The whole night→morning structure depends on it. Render and judge this one first.

## Every prompt carries the same four locks

1. **CONTINUITY** — begins already in motion at the previous shot's speed/light. No reset.
2. **"Only the camera and clouds move"** — a whitelist, which beats listing animations to ban.
3. **Occlusion reveal** — the landmark is *already there* behind the vapour, uncovered as cloud moves aside. Never fades/dissolves in.
4. **GEOMETRY** — rigid proportions, correct perspective, no warping; scale changes only from camera approach.

## After rendering

1. Download all 11 clips
2. Encode for scroll-scrubbing:
   `ffmpeg -i in.mp4 -an -c:v libx264 -preset slow -crf 20 -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4`
3. Wire into `landing/` (the scrub engine already supports the chain)
4. QA every seam — screenshot just before and after each join; compositions must match
