import * as Sentry from '@sentry/nextjs'

/**
 * Error reporting (DEV-50). Loads the runtime's Sentry config; both are inert
 * — `enabled: false`, nothing sent — until `SENTRY_DSN` is set. What may leave
 * the site is decided in lib/observability.ts, not here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

export const onRequestError = Sentry.captureRequestError
