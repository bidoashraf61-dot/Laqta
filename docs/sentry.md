# Error monitoring — Sentry

Laqta reports **errors only** to Sentry. No performance tracing unless a sample
rate is set, and **no session replay** — no analytics or consent decision has
been made, and a replay is a recording of the visitor. With no DSN set the SDK
is disabled and sends nothing.

## Status (2026-09-24)

| Part | State |
| --- | --- |
| Privacy scrubber + shared options — `lib/observability.ts` | Done, unit-tested (`tests/unit/observability.test.ts`) |
| Env vars — `.env.example` | Done |
| Privacy-policy sentence (AR + EN) — `content/legal.ts` `PRIVACY` | Done, **flagged for counsel** |
| `@sentry/nextjs` dependency + SDK wiring | **Not done** — the package could not be installed from the build session (npm registry TLS failed there). See "Finishing the wiring". |

## What leaves the site, and what never does

Sent with an error: the exception and stack, the route **without its query
string**, the browser user-agent and language, the release.

Never sent (enforced in `scrubEvent`, the `beforeSend` hook): the user object
(no id, email or IP), cookies, request bodies, query strings, any header other
than `user-agent` / `accept-language` / `referer` / `content-type`, and any
email, IP or phone number appearing in an error message, breadcrumb or extra.
`sendDefaultPii` is `false`.

## Owner setup

1. Create a Sentry organisation and one project, platform **Next.js**. Choose
   the **EU data region** if offered, and tell counsel which region you chose.
2. Copy the project's DSN into the deployment's env as both `SENTRY_DSN` and
   `NEXT_PUBLIC_SENTRY_DSN`, then **rebuild** (the browser DSN is inlined at
   build time).
3. Project → Settings → Security & Privacy: turn on **Prevent storing of IP
   addresses** and **Data scrubber** (with default scrubbers). This is a second
   net under `scrubEvent`, not a replacement for it.
4. Optional, for readable stack traces: create an org auth token with
   `project:releases` scope and set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
   `SENTRY_PROJECT` in CI. Without them the build still passes; source maps are
   simply not uploaded.
5. Leave `SENTRY_TRACES_SAMPLE_RATE` empty unless you want performance data;
   anything above `0` sends traces.
6. Have counsel review the privacy sentence added under «من يطّلع على بياناتك»
   (it names no vendor or transfer country; they may want both).

## Finishing the wiring

On a machine that can reach the npm registry: `npm install @sentry/nextjs`,
then add, per the current Sentry Next.js App Router manual setup:

- `instrumentation.ts` — `register()` imports `sentry.server.config` (nodejs)
  or `sentry.edge.config` (edge); `export const onRequestError = Sentry.captureRequestError`.
- `sentry.server.config.ts` / `sentry.edge.config.ts` —
  `Sentry.init(sentryOptions(process.env.SENTRY_DSN, process.env.SENTRY_TRACES_SAMPLE_RATE))`.
- `instrumentation-client.ts` —
  `Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE))`,
  **no** `replayIntegration`, and `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart`.
- `next.config.mjs` — wrap in `withSentryConfig(nextConfig, { org, project, authToken: process.env.SENTRY_AUTH_TOKEN, silent: !process.env.CI, sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN }, telemetry: false })`.
- `app/error.tsx` — `Sentry.captureException(error)` in its effect (it
  currently only `console.error`s); add an `app/global-error.tsx` that does the
  same for root-layout failures.

Then `npm run build` with no Sentry env must still pass.
