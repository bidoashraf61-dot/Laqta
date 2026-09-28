import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/observability'

// The browser. Inert without NEXT_PUBLIC_SENTRY_DSN (inlined at build time).
// Errors only: no replayIntegration — a replay is a recording of the visitor.
Sentry.init(
  sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
)

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
