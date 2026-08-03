import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@prisma/client'

/**
 * Edge-safe half of the Auth.js config.
 *
 * `middleware.ts` runs on the edge runtime, where bcryptjs and the Prisma
 * client cannot load. This file therefore contains only what middleware needs
 * to *read* a session — no providers, no database. `lib/auth.ts` spreads it
 * and adds the credential providers and the DB-backed callbacks.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/ar/sign-in',
    error: '/ar/sign-in',
  },
  trustHost: true,
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string
        session.user.role = (token.role as Role) ?? 'buyer'
        session.user.locale = (token.locale as string) ?? 'ar'
        session.user.creatorId = (token.creatorId as string | null) ?? null
        if (token.impersonatedBy) {
          session.user.impersonatedBy = token.impersonatedBy as string
        }
      }
      return session
    },
  },
} satisfies NextAuthConfig
