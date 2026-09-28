# Laqta — the production image (DEV-14).
#
# One image, any host that runs a container (Render, DigitalOcean, AWS
# Lightsail): Node 22, ffmpeg for the preview pipeline, Chromium for licence
# certificates and invoices, the Postgres 17 client for backups. On start it
# applies pending migrations, then serves. Owner guide: docs/tech/hosting.md.
#
#   docker build -t laqta \
#     --build-arg NEXT_PUBLIC_MEDIA_CDN_URL=https://media.example \
#     --build-arg NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXX \
#     --build-arg NEXT_PUBLIC_SENTRY_DSN=https://…  .
#
# NEXT_PUBLIC_* values are baked into the browser code at BUILD time, so they
# are build arguments; every other setting is a runtime environment variable.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ── Build ───────────────────────────────────────────────────────────────────
FROM deps AS build
ARG NEXT_PUBLIC_MEDIA_CDN_URL=""
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=""
ARG NEXT_PUBLIC_CONTACT_EMAIL=""
ARG NEXT_PUBLIC_CONTACT_WHATSAPP=""
# The build refuses to write localhost links in production (lib/site.ts), so
# the public origin is needed here too. Source-map upload runs only when a
# SENTRY_AUTH_TOKEN build secret is passed.
ARG SITE_ORIGIN
ENV NEXT_PUBLIC_MEDIA_CDN_URL=$NEXT_PUBLIC_MEDIA_CDN_URL \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=$NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_PUBLIC_CONTACT_WHATSAPP=$NEXT_PUBLIC_CONTACT_WHATSAPP \
    SITE_ORIGIN=$SITE_ORIGIN \
    AUTH_URL=$SITE_ORIGIN
COPY . .
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PDF_BROWSER_CHANNEL=bundled \
    DOCUMENT_ROOT=/data/documents \
    BACKUP_DIR=/data/backups \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ffmpeg (previews), the Postgres 17 client (pg_dump / pg_restore for backups,
# from the PostgreSQL apt repository — Debian's own is too old for a v16/17
# server), and curl for the health check.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates gnupg openssl \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app
# Playwright's own Chromium plus the system libraries it needs (Arabic fonts
# come from the app's own Thmanyah files, embedded in each document).
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data/documents /data/backups /app/.media && chown -R node:node /data /app/.next /app/.media
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

# Migrations on every deploy, then the server. `migrate deploy` only applies
# what is new and never resets data.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm start"]
