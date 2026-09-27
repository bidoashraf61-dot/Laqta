import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@prisma/client'
import { expireIfDue, type ImpersonationClaim } from '@/lib/impersonation-shared'

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
    /**
     * Edge half of the token lifecycle: only the view-as-user clock. An
     * expired view is swapped back to the admin here, so middleware — which
     * runs this on every request and re-issues the cookie — never lets a view
     * outlive its `expiresAt`. `lib/auth.ts` runs the same check first.
     */
    jwt({ token }) {
      return expireIfDue(token)
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string
        session.user.role = (token.role as Role) ?? 'buyer'
        session.user.locale = (token.locale as string) ?? 'ar'
        session.user.creatorId = (token.creatorId as string | null) ?? null
        session.user.twoFactorEnabled = twoFactorClaim(token)
        applyImpersonationToSession(session.user, token)
      }
      return session
    },
  },
} satisfies NextAuthConfig

/**
 * Mirror an active view onto the session: who is really looking, which row
 * audits it, and when it ends — the banner reads all three. Shared by both
 * halves so the edge and the node session can never disagree.
 */
export function applyImpersonationToSession(
  user: { impersonatedBy?: string; impersonation?: SessionImpersonation },
  token: Record<string, unknown>,
) {
  const imp = token.imp as ImpersonationClaim | undefined
  if (!imp) return
  user.impersonatedBy = imp.admin.uid
  user.impersonation = {
    id: imp.id,
    expiresAt: new Date(imp.expiresAt).toISOString(),
    targetName: imp.targetName,
  }
}

/**
 * The `tfa` claim: whether the account has enrolled in two-factor. Undefined
 * on a cookie minted before the claim existed — middleware leaves those to the
 * layout, which reads the database (lib/two-factor.ts).
 */
export function twoFactorClaim(token: Record<string, unknown>): boolean | undefined {
  return typeof token.tfa === 'boolean' ? token.tfa : undefined
}

export type SessionImpersonation = { id: string; expiresAt: string; targetName: string }
