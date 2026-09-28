# Hosting — how the site runs in production (DEV-14)

Status 2026-09-28: **the package is ready; the host is not chosen yet (BIZ-07).**
Everything below works on any of the three options. Nothing here has run on a
real host yet — the first real build is part of DEV-16 (test site online).

## What was built

| Piece | File | What it does |
| --- | --- | --- |
| Server image | `Dockerfile` | Node 22 + ffmpeg (previews) + Chromium (licence certificates, invoices) + Postgres 17 client (backups). Runs as a non-root user. |
| Migrations on deploy | `Dockerfile` `CMD` | `prisma migrate deploy` before every start — applies only what is new, never resets data. |
| Health check | `GET /api/health` | 200 when the database answers, 503 when not. Used by the container `HEALTHCHECK`, the host, and uptime monitoring (DEV-59). |
| Daily backups | `npm run db:backup` | `pg_dump` → `/data/backups`, then copied to S3 `backups/` (encrypted). Keeps 7 on disk. Fails loudly. |
| Restore | `npm run db:restore -- <file or s3 key>` | Into a scratch database (`RESTORE_DATABASE_URL`); refuses the live one unless `--into-live`. Prints row counts. Rehearsed in DEV-56. |
| One-server setup | `docker-compose.yml` | App + Postgres on one machine (DigitalOcean / Lightsail). |
| Logo + icons in git | `.gitignore` | `public/brand/*.png`, `app/icon.png`, `app/apple-icon.png` were ignored — a deploy from git would have had no logo or favicon. Now tracked. |

## Settings the host needs

- **Build arguments** (baked into the browser code — change → rebuild):
  `SITE_ORIGIN`, `NEXT_PUBLIC_MEDIA_CDN_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`,
  `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`.
- **Runtime environment**: everything else in `.env.example` — `DATABASE_URL`,
  `AUTH_SECRET`, `AUTH_URL` (= `SITE_ORIGIN`), AWS/S3, `MAIL_*`, `PAYMOB_*`,
  `SENTRY_DSN`, `CRON_SECRET`, `BANK_*`, `CONTACT_*`, `VAT_RATE`.
- **Disk**: `/data` (documents + backup copies) should survive restarts. `/app/.media`
  needs room for a whole master while it is processed — **at least 50 GB** if creators
  upload 20 GB files.
- **Hero film**: `public/hero/vid/` is not in git. In production it is served from
  the media CDN (`NEXT_PUBLIC_MEDIA_CDN_URL`, `npm run media:upload`).

## Two jobs a day

Both are commands in the image; the host runs them on a schedule.

| When | Command | Or by URL |
| --- | --- | --- |
| 07:00 | `npm run jobs:daily` (reminders + operator digest) | `POST /api/cron/daily` with `Authorization: Bearer <CRON_SECRET>` |
| 03:00 | `npm run db:backup` | — |

On a single server: `crontab -e` →
`0 3 * * * cd /opt/laqta && docker compose exec -T app npm run db:backup` and
`0 7 * * * cd /opt/laqta && docker compose exec -T app npm run jobs:daily`.
On Render: two **Cron Jobs** from the same image running those commands.

## S3 lifecycle rule for backups

In the masters bucket → Management → Lifecycle rule: prefix `backups/`, expire
current versions after **35 days**. Five weeks of daily backups, then they delete
themselves.

## Recommendation (research 2026-09-28, for BIZ-07)

**Hetzner Cloud CX33 + Cloudflare R2 + Cloudflare DNS/proxy, domain at Cloudflare
Registrar.** About **$28/month at launch** (500 GB stored, 2 TB downloaded), **$35–60**
at 1 TB / 5 TB.

| Piece | Choice | ~Monthly | Why |
| --- | --- | --- | --- |
| Server | Hetzner CX33 (4 vCPU, 8 GB, 80 GB), Germany, + backups, + 100 GB volume for `/app/.media` | ~$18 | 4× Render's CPU for a third of the price — ffmpeg on 20 GB masters needs it. Runs `docker-compose.yml` as-is, Caddy for SSL |
| Database | Postgres in the same compose file | included | Daily `db:backup` to R2 + Hetzner server backups |
| Video storage + delivery | Cloudflare R2: private masters bucket + public media bucket on `media.<domain>` | ~$8 | **No download (egress) fees.** S3 + CloudFront would add ~$110/month at launch and ~$450 at growth, because buyers download multi-GB masters |
| Domain | `.com` at Cloudflare Registrar | ~$1 | At-cost renewals. `.sa` is not realistic: SaudiNIC wants a Saudi entity or trademark and a Saudi contact |
| DNS, SSL, WAF, DDoS | Cloudflare free plan, "Full (strict)" | $0 | Resend's SPF/DKIM/MX/DMARC records must be "DNS only" (grey cloud) |
| Monitoring | UptimeRobot on `/api/health`, Sentry free | $0 | |

**The zero-maintenance alternative:** Render (web + Postgres + disk + crons) + R2,
about **$70–75/month** — nothing to patch, but one CPU makes video processing slow and a
disk-backed service redeploys with a short outage.

**R2 settings** (the code supports it — `S3_ENDPOINT`, fixed 2026-09-28 so the AWS-only
encryption header is not sent): `AWS_REGION=auto`,
`S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, the R2 API token in
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, `MASTERS_CDN_URL` and `CLOUDFRONT_*`
empty (downloads use presigned URLs). CORS on the masters bucket must expose `ETag` for
the multipart upload. Public media on an R2 **custom domain**, not `r2.dev`.

**Security basics:** Hetzner firewall — only 80/443 open, SSH from your IP only;
automatic security updates; secrets in a root-only `.env` on the server, never in git.

## The three options (for BIZ-07)

| | Render (recommended) | DigitalOcean droplet | AWS Lightsail |
| --- | --- | --- | --- |
| What you manage | Nothing but settings | The server (updates, disk, Caddy) | The server |
| Database | Render Postgres, daily snapshots included | In `docker-compose.yml` on the same box (our backups only) | Same as DO, or Lightsail managed DB |
| Approx. monthly | ~$50–70 (web $25 + Postgres $20 + disk + 2 cron jobs) | ~$30–45 | ~$40–60 |
| SSL | Automatic | Caddy (automatic Let's Encrypt) | Caddy |
| Region | Frankfurt | Frankfurt | Frankfurt or Bahrain |
