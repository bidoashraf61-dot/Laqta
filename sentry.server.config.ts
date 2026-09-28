import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/observability'

// Inert without SENTRY_DSN. Options and the privacy scrubber: lib/observability.ts.
Sentry.init(sentryOptions(process.env.SENTRY_DSN, process.env.SENTRY_TRACES_SAMPLE_RATE))
