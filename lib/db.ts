import { PrismaClient } from '@prisma/client'
import { IMPERSONATION_HEADER } from '@/lib/impersonation-shared'

/**
 * Single Prisma client. Next.js dev-mode hot reload would otherwise open a new
 * connection pool on every recompile and exhaust Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])

/**
 * The only tables a view-as-user request may write: the view's own row (ending
 * it) and the audit trail that records it. Everything else is the customer's
 * data, and a support view is read-only.
 */
const WRITABLE_DURING_VIEW = new Set(['Impersonation', 'AuditLog'])

export class ReadOnlyImpersonationError extends Error {
  constructor(model: string, operation: string) {
    super(`READ_ONLY_IMPERSONATION: ${model}.${operation} refused during a view-as-user session`)
    this.name = 'ReadOnlyImpersonationError'
  }
}

/**
 * Is the current request part of a view-as-user session? Middleware stamps the
 * header (and strips any a client sent), so its presence is authoritative.
 * Outside a request — scripts, the seed, the outbox drain — there are no
 * headers and nothing is being viewed.
 */
async function inView(): Promise<boolean> {
  try {
    const { headers } = await import('next/headers')
    return (await headers()).get(IMPERSONATION_HEADER) === '1'
  } catch {
    return false
  }
}

/**
 * The data-layer half of "view-as-user is read-only" (see
 * lib/impersonation-shared.ts). Middleware already refuses every non-GET
 * request during a view; this refuses the write itself, so a GET handler that
 * writes and was never put on middleware's list still changes nothing.
 */
function withReadOnlyGuard(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (WRITE_OPERATIONS.has(operation) && !WRITABLE_DURING_VIEW.has(model) && (await inView())) {
            throw new ReadOnlyImpersonationError(model, operation)
          }
          return query(args)
        },
      },
    },
    // The extended client keeps PrismaClient's whole surface; the cast only
    // restores the nominal type every `db` call site and helper is written
    // against.
  }) as unknown as PrismaClient
}

export const db =
  globalForPrisma.prisma ??
  withReadOnlyGuard(
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    }),
  )

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
