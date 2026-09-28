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

## The three options (for BIZ-07)

| | Render (recommended) | DigitalOcean droplet | AWS Lightsail |
| --- | --- | --- | --- |
| What you manage | Nothing but settings | The server (updates, disk, Caddy) | The server |
| Database | Render Postgres, daily snapshots included | In `docker-compose.yml` on the same box (our backups only) | Same as DO, or Lightsail managed DB |
| Approx. monthly | ~$50–70 (web $25 + Postgres $20 + disk + 2 cron jobs) | ~$30–45 | ~$40–60 |
| SSL | Automatic | Caddy (automatic Let's Encrypt) | Caddy |
| Region | Frankfurt | Frankfurt | Frankfurt or Bahrain |
