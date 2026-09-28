# Health check

**Route** `GET /api/health` · **Access** public · **Rendering** route handler, dynamic (`force-dynamic`, `no-store`)

## Purpose
Tell the host and the uptime monitor whether the site can serve: the container's
`HEALTHCHECK` (Dockerfile), the host's own probe, and DEV-59 monitoring all call it
(DEV-14, `docs/tech/hosting.md`).

## Data in
- `db.$queryRaw\`SELECT 1\`` — one round trip to Postgres.

## Controls
None — machine endpoint.

## States
- Database answers → `200 { ok: true }`.
- Database unreachable (or the query throws) → `503 { ok: false }`, so the host restarts
  or stops routing to the instance.

## Invariants
- Says nothing else: no version, commit, counts, env or error text — a stranger learns
  only up or down.
- Outside the middleware matcher (`api/health`): no session, locale or role logic runs
  in front of it, and it never redirects.
- Never cached.

## Verified by
Called once by hand in development (200 with the database up). The container health
check itself first runs on the host in DEV-16.
