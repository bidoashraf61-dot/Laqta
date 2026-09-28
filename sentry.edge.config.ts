import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/observability'

// Middleware and edge routes. Inert without SENTRY_DSN.
Sentry.init(sentryOptions(process.env.SENTRY_DSN, process.env.SENTRY_TRACES_SAMPLE_RATE))
