# Video on AWS — S3 + CloudFront

All Laqta video lives on AWS: the hero film, every clip's watermarked preview,
album trailers, posters, and the masters buyers download. This is the one-time
setup and the day-to-day pipeline. The code side is `lib/storage.ts` (private
masters), `lib/media.ts` (public media URLs) and `scripts/media-*.ts`.

## The two buckets

| Bucket | Holds | Public? | Reached by |
| --- | --- | --- | --- |
| `S3_MASTERS_BUCKET` (e.g. `laqta-masters`) | masters `masters/…`, clean editing proxies `proxies/…`, album ZIPs `albums/…` | **Never.** Block all public access. | `/api/download` only — after the entitlement is re-checked it 302s to a URL that expires in `S3_SIGNED_URL_TTL_SECONDS` (default 900s) |
| `S3_MEDIA_BUCKET` (e.g. `laqta-media`) | `hero/`, `previews/`, `posters/`, `trailers/` | Through CloudFront only (the bucket itself stays private, OAC) | `NEXT_PUBLIC_MEDIA_CDN_URL` + key |

A master is the product. Nothing public ever points into the masters bucket,
and `lib/media.ts` refuses to build a public URL for a `masters/`, `proxies/`,
`albums/` or `documents/` key even by mistake.

## One-time AWS setup

1. **Pick a region** close to Saudi buyers (e.g. `me-central-1` UAE or
   `eu-central-1`) → `AWS_REGION`.
2. **Create both buckets** in that region. Leave *Block all public access* ON
   for both. Enable default encryption (SSE-S3). Optional: a lifecycle rule
   moving `masters/` to S3 Intelligent-Tiering.
3. **Media distribution.** CloudFront → Create distribution → origin =
   the media bucket's S3 REST endpoint → *Origin access: Origin access control
   (OAC)* → create an OAC, then paste the bucket policy CloudFront offers into
   the media bucket. Viewer protocol: *Redirect HTTP to HTTPS*. Cache policy:
   *CachingOptimized*. Response headers policy: *CORS-with-preflight*
   (or a custom one allowing `GET, HEAD` from your site origin). Add an
   alternate domain (e.g. `media.laqta.example`) with an ACM certificate from
   **us-east-1**. → `NEXT_PUBLIC_MEDIA_CDN_URL="https://media.laqta.example"`.
   S3 serves `Accept-Ranges: bytes`, which the hero's scroll-scrub needs to
   seek without downloading the whole film.
4. **Masters signing** — choose one:
   - **S3 presigned (simplest).** Nothing more to do. Downloads come straight
     from the bucket with a presigned GET.
   - **CloudFront signed (cheaper egress on large files).** Create a second
     distribution with the masters bucket as origin (OAC again, bucket policy
     again). Generate a key pair locally
     (`openssl genrsa -out cf.pem 2048 && openssl rsa -pubout -in cf.pem -out cf.pub`),
     upload `cf.pub` under CloudFront → *Public keys*, put it in a *Key group*,
     and on the distribution's behaviour set *Restrict viewer access: Yes →
     Trusted key groups*. Then set `MASTERS_CDN_URL` (the distribution
     domain), `CLOUDFRONT_KEY_PAIR_ID` (the public key's ID) and
     `CLOUDFRONT_PRIVATE_KEY` (contents of `cf.pem`, newlines as `\n`). All
     three or none; with any missing the app falls back to S3 presigning.
5. **An IAM identity for the app** — an instance/task role on the server, or
   an IAM user whose keys go in `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
   Least privilege:
   - `s3:GetObject` on `arn:aws:s3:::laqta-masters/*` (download signing and
     `media:previews` fetching masters)
   - `s3:PutObject`, `s3:GetObject` on `arn:aws:s3:::laqta-media/*` and
     `s3:ListBucket` on `arn:aws:s3:::laqta-media` (`media:upload`; List makes
     the "already uploaded" check answer 404 instead of 403)
   The uploading machine (your Mac) can use a separate user with just the
   media permissions plus `GetObject` on masters.
6. **Set the variables** (see `.env.example`) on the server **before**
   `npm run build` — `NEXT_PUBLIC_MEDIA_CDN_URL` is inlined at build time.
   `/admin/settings` shows the storage badge green once masters are on S3.

## Day to day (solo operator)

```bash
# 1. Put masters where the script can read them: the masters bucket, or a
#    local folder mirroring the keys (MEDIA_MASTERS_DIR, default .media/masters)
# 2. Make previews + posters (ffmpeg with libx264, and Chrome for the watermark)
npm run media:previews -- --album <album-slug>          # or --clip, --limit, --force
# 3. Optional: drop a cut trailer at .media/out/trailers/<album-slug>.mp4
# 4. Push everything, and point the DB at it
npm run media:upload -- --dry-run                        # look first
npm run media:upload                                     # hero + previews + posters + trailers
```

- Previews: 720p short side, H.264 High, yuv420p, `+faststart`, no audio,
  ≤30fps, ≤30s, with the site's «لقطة · معاينة» watermark burnt in (rendered
  by Chrome from the same CSS as `components/catalogue/watermark.tsx`).
- Without `AWS_REGION` + `S3_MEDIA_BUCKET`, `media:upload` is always a dry run:
  it lists what it would do and changes nothing.
- A trailer can also be set by hand: `/admin/catalogue` → «التريلر» on the
  album's row → the key (e.g. `trailers/<album-slug>.mp4`).
- Replaced a file under the same key? Objects carry `Cache-Control:
  max-age=86400`; invalidate `/<key>` on the media distribution to see it now.

## What is not done yet

- **HLS / adaptive streaming.** Previews are single progressive MP4s.
  `Clip.previewHlsKey` exists and nothing writes or reads it.
- **Creator uploads** do not land in S3 yet — there is no upload flow in the
  studio. Masters reach the bucket by hand (console, `aws s3 cp`) for now.
- **Album ZIPs** (`albums/<id>.zip`) are signed but nothing builds them.
